-- Throwaway transaction shapes; no Supabase authorization/RLS/provider integration.
CREATE TABLE account_head(account bigint PRIMARY KEY, seq bigint NOT NULL DEFAULT 0, total bigint NOT NULL DEFAULT 0, sharing bigint NOT NULL DEFAULT 1, device int NOT NULL DEFAULT 1, generation bigint NOT NULL DEFAULT 1, remaining bigint NOT NULL DEFAULT 100, deleted boolean NOT NULL DEFAULT false);
CREATE TABLE receipt(account bigint REFERENCES account_head ON DELETE CASCADE, op text, hash text NOT NULL, disposition text NOT NULL, seq bigint NOT NULL, PRIMARY KEY(account,op));
CREATE TABLE result(account bigint REFERENCES account_head ON DELETE CASCADE, id text, summary jsonb NOT NULL, payload bytea, seq bigint NOT NULL, PRIMARY KEY(account,id));
CREATE TABLE feed(account bigint REFERENCES account_head ON DELETE CASCADE, seq bigint, kind text, item text, PRIMARY KEY(account,seq));
CREATE TABLE allowance(account bigint REFERENCES account_head ON DELETE CASCADE, reset bigint, budget bigint, PRIMARY KEY(account,reset));
CREATE TABLE contribution(account bigint REFERENCES account_head ON DELETE CASCADE, period bigint, item text, PRIMARY KEY(account,period,item));
CREATE VIEW visible_contribution AS SELECT c.* FROM contribution c JOIN account_head a USING(account) WHERE NOT a.deleted AND a.sharing=c.period AND a.sharing>0;
CREATE TABLE stage(account bigint REFERENCES account_head ON DELETE CASCADE, item text, part int, hash text, payload bytea, touched timestamptz DEFAULT now(), PRIMARY KEY(account,item,part));
CREATE TABLE manifest(account bigint REFERENCES account_head ON DELETE CASCADE, item text, parts int, bytes bigint, PRIMARY KEY(account,item));
CREATE TABLE snapshot(id text PRIMARY KEY, account bigint REFERENCES account_head ON DELETE CASCADE, watermark bigint, total bigint, expires timestamptz DEFAULT now()+interval '24 hours');
CREATE TABLE snapshot_row(snapshot text REFERENCES snapshot ON DELETE CASCADE, item text, summary jsonb, seq bigint, PRIMARY KEY(snapshot,item));
CREATE TABLE export_job(id text PRIMARY KEY, account bigint REFERENCES account_head ON DELETE CASCADE, snapshot text REFERENCES snapshot ON DELETE CASCADE, cursor text, expires timestamptz DEFAULT now()+interval '24 hours');
CREATE FUNCTION apply(a bigint,o text,h text,k text,p bytea DEFAULT NULL,e bigint DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE hd account_head; r receipt; d text := 'accepted'; lock_at timestamptz; n bigint;
BEGIN
 SELECT * INTO hd FROM account_head WHERE account=a FOR UPDATE;
 lock_at := clock_timestamp();
 IF NOT FOUND OR hd.deleted THEN RAISE EXCEPTION 'account unavailable'; END IF;
 SELECT * INTO r FROM receipt WHERE account=a AND op=o;
 IF FOUND THEN
  IF r.hash<>h THEN RAISE EXCEPTION 'identity-content mismatch'; END IF;
  RETURN jsonb_build_object('disposition',r.disposition,'seq',r.seq,'retry',true,'lock_at',extract(epoch FROM lock_at),'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
 END IF;
 n:=hd.seq+1;
 IF k='result' THEN
  INSERT INTO result VALUES(a,o,jsonb_build_object('game','blackjack','net',1,'id',o,'revision','synthetic-v1'),p,n);
  UPDATE account_head SET total=total+1 WHERE account=a;
 ELSIF k='grant' THEN
  INSERT INTO allowance VALUES(a,e,100) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN d:='existing-grant'; END IF;
 ELSIF k='transfer' THEN
  IF hd.generation<>e THEN d:='generation-conflict'; ELSE UPDATE account_head SET device=2,generation=generation+1 WHERE account=a; END IF;
 ELSIF k='withdraw' THEN UPDATE account_head SET sharing=0 WHERE account=a;
 ELSIF k='enable' THEN
  IF hd.sharing<>e THEN d:='period-conflict'; ELSE UPDATE account_head SET sharing=hd.seq+2 WHERE account=a; END IF;
 ELSIF k='contribute' THEN
  IF hd.sharing<>e OR e=0 THEN d:='revoked-period'; ELSE INSERT INTO contribution VALUES(a,e,o); END IF;
 ELSE RAISE EXCEPTION 'unsupported operation';
 END IF;
 UPDATE account_head SET seq=n WHERE account=a;
 INSERT INTO receipt VALUES(a,o,h,d,n);
 INSERT INTO feed VALUES(a,n,k,o);
 RETURN jsonb_build_object('disposition',d,'seq',n,'retry',false,'lock_at',extract(epoch FROM lock_at),'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
END $$;
CREATE FUNCTION take_snapshot(a bigint,s text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE hd account_head; lock_at timestamptz;
BEGIN
 SELECT * INTO hd FROM account_head WHERE account=a FOR UPDATE;
 lock_at:=clock_timestamp();
 IF NOT FOUND OR hd.deleted THEN RAISE EXCEPTION 'account unavailable'; END IF;
 INSERT INTO snapshot(id,account,watermark,total) VALUES(s,a,hd.seq,hd.total);
 INSERT INTO snapshot_row SELECT s,id,summary,seq FROM result WHERE account=a;
 RETURN jsonb_build_object('watermark',hd.seq,'total',hd.total,'lock_at',extract(epoch FROM lock_at),'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
END $$;

-- ---------------------------------------------------------------------------
-- Additions for the bounded sweep (2026-09-14): durable chunks, staging,
-- chunked completion, expiry sweep, two-phase deletion with tombstones.
-- Still throwaway shapes: no RLS, no auth, no provider integration.
-- ---------------------------------------------------------------------------
CREATE TABLE result_chunk(account bigint, item text, part int, hash text NOT NULL, payload bytea NOT NULL, PRIMARY KEY(account,item,part), FOREIGN KEY(account,item) REFERENCES result(account,id) ON DELETE CASCADE);
CREATE TABLE tombstone(account bigint PRIMARY KEY, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX stage_touched ON stage(touched);
CREATE INDEX snapshot_expires ON snapshot(expires);
CREATE INDEX export_expires ON export_job(expires);
CREATE INDEX snapshot_account ON snapshot(account);
CREATE INDEX export_account ON export_job(account);
CREATE FUNCTION deny_reuse() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM tombstone WHERE account=NEW.account) THEN RAISE EXCEPTION 'account id % is tombstoned', NEW.account; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_head_deny_reuse BEFORE INSERT ON account_head FOR EACH ROW EXECUTE FUNCTION deny_reuse();
-- Private staging of one content-hashed chunk. Idempotent for identical bytes; different bytes under the same identity are rejected.
CREATE FUNCTION stage_part(a bigint, i text, p int, h text, b bytea) RETURNS text LANGUAGE plpgsql AS $$
DECLARE existing text;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM account_head WHERE account=a AND NOT deleted) THEN RAISE EXCEPTION 'account unavailable'; END IF;
 -- The server hashes the bytes itself. The first harness version trusted the client hash and accepted tampered bytes (caught by the tampered-chunk assertion).
 IF encode(sha256(b),'hex')<>h THEN RAISE EXCEPTION 'chunk hash mismatch'; END IF;
 INSERT INTO stage(account,item,part,hash,payload) VALUES(a,i,p,h,b) ON CONFLICT (account,item,part) DO NOTHING;
 IF FOUND THEN RETURN 'staged'; END IF;
 SELECT hash INTO existing FROM stage WHERE account=a AND item=i AND part=p;
 IF existing<>h THEN RAISE EXCEPTION 'chunk identity-content mismatch'; END IF;
 UPDATE stage SET touched=now() WHERE account=a AND item=i AND part=p;
 RETURN 'already-staged';
END $$;
-- Final acceptance of a chunked result: verifies the manifest against staged parts under the head lock, then commits result, chunks, receipt and feed together.
CREATE FUNCTION complete_chunked(a bigint, o text, h text, i text, parts int, bytes bigint, part_hashes text[]) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE hd account_head; r receipt; n bigint; lock_at timestamptz; have int; total_bytes bigint; hashes text[];
BEGIN
 SELECT * INTO hd FROM account_head WHERE account=a FOR UPDATE;
 lock_at := clock_timestamp();
 IF NOT FOUND OR hd.deleted THEN RAISE EXCEPTION 'account unavailable'; END IF;
 SELECT * INTO r FROM receipt WHERE account=a AND op=o;
 IF FOUND THEN
  IF r.hash<>h THEN RAISE EXCEPTION 'identity-content mismatch'; END IF;
  RETURN jsonb_build_object('disposition',r.disposition,'seq',r.seq,'retry',true,'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
 END IF;
 SELECT count(*), coalesce(sum(length(payload)),0), array_agg(hash ORDER BY part) INTO have, total_bytes, hashes FROM stage WHERE account=a AND item=i;
 IF have<>parts OR total_bytes<>bytes OR hashes IS DISTINCT FROM part_hashes THEN
  RAISE EXCEPTION 'incomplete staging: % of % parts, % of % bytes', have, parts, total_bytes, bytes;
 END IF;
 n := hd.seq+1;
 INSERT INTO manifest VALUES(a,i,parts,bytes);
 INSERT INTO result VALUES(a,i,jsonb_build_object('game','blackjack','net',1,'id',i,'revision','synthetic-v1','chunks',parts,'bytes',bytes),NULL,n);
 INSERT INTO result_chunk SELECT account,item,part,hash,payload FROM stage WHERE account=a AND item=i;
 DELETE FROM stage WHERE account=a AND item=i;
 UPDATE account_head SET total=total+1, seq=n WHERE account=a;
 INSERT INTO receipt VALUES(a,o,h,'accepted',n);
 INSERT INTO feed VALUES(a,n,'result',i);
 RETURN jsonb_build_object('disposition','accepted','seq',n,'retry',false,'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
END $$;
-- Hourly expiry sweep: abandoned staging after 24 hours without progress; snapshots and exports after their 24-hour lifetime.
CREATE FUNCTION sweep_expired() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s int; sn int; e int;
BEGIN
 DELETE FROM stage WHERE touched < now()-interval '24 hours'; GET DIAGNOSTICS s=ROW_COUNT;
 DELETE FROM export_job WHERE expires < now(); GET DIAGNOSTICS e=ROW_COUNT;
 DELETE FROM snapshot WHERE expires < now(); GET DIAGNOSTICS sn=ROW_COUNT;
 RETURN jsonb_build_object('stage',s,'export',e,'snapshot',sn);
END $$;
-- Deletion phase 1: immediate access denial and public suppression under the head lock (an accepted deletion is also receipted).
CREATE FUNCTION delete_account(a bigint, o text, h text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE hd account_head; r receipt; n bigint; lock_at timestamptz;
BEGIN
 SELECT * INTO hd FROM account_head WHERE account=a FOR UPDATE;
 lock_at := clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'account unavailable'; END IF;
 SELECT * INTO r FROM receipt WHERE account=a AND op=o;
 IF FOUND THEN RETURN jsonb_build_object('disposition',r.disposition,'seq',r.seq,'retry',true,'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000); END IF;
 n := hd.seq+1;
 UPDATE account_head SET deleted=true, sharing=0, seq=n WHERE account=a;
 INSERT INTO receipt VALUES(a,o,h,'accepted',n);
 INSERT INTO feed VALUES(a,n,'delete',o);
 RETURN jsonb_build_object('disposition','accepted','seq',n,'retry',false,'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
END $$;
-- Deletion phase 2: physical cleanup within the seven-day target. Leaves a tombstone so the ID is never reused.
CREATE FUNCTION cleanup_account(a bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE hd account_head; lock_at timestamptz; nr bigint; nf bigint; nc bigint; ns bigint;
BEGIN
 SELECT * INTO hd FROM account_head WHERE account=a FOR UPDATE;
 lock_at := clock_timestamp();
 IF NOT FOUND OR NOT hd.deleted THEN RAISE EXCEPTION 'account not scheduled for cleanup'; END IF;
 SELECT count(*) INTO nr FROM result WHERE account=a;
 SELECT count(*) INTO nf FROM feed WHERE account=a;
 SELECT count(*) INTO nc FROM result_chunk WHERE account=a;
 SELECT count(*) INTO ns FROM snapshot_row sr JOIN snapshot s ON s.id=sr.snapshot WHERE s.account=a;
 INSERT INTO tombstone(account) VALUES(a);
 DELETE FROM account_head WHERE account=a;
 RETURN jsonb_build_object('results',nr,'feed',nf,'chunks',nc,'snapshot_rows',ns,'lock_precommit_ms',extract(epoch FROM clock_timestamp()-lock_at)*1000);
END $$;
