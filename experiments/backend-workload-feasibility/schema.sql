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
