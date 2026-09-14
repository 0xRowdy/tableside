#!/usr/bin/env python3
"""Run farmer_driver over a large composition file in parallel chunks and
concatenate the outputs (header written once).

Usage:
    python3 run_driver_parallel.py <driver> <compositions.txt> <out.csv> <workers> [driver args...]
"""
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor


def run_chunk(driver, args, lines, idx, tmpdir):
    inp = os.path.join(tmpdir, f"in_{idx}.txt")
    out = os.path.join(tmpdir, f"out_{idx}.csv")
    with open(inp, "w") as f:
        f.writelines(lines)
    with open(inp) as fi, open(out, "w") as fo:
        subprocess.run([driver] + args, stdin=fi, stdout=fo, check=True)
    return out


def main():
    driver, comps, dest, workers = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
    args = sys.argv[5:]
    with open(comps) as f:
        lines = f.readlines()
    chunks = max(workers * 4, 1)
    size = (len(lines) + chunks - 1) // chunks
    parts = [lines[i:i + size] for i in range(0, len(lines), size)]
    with tempfile.TemporaryDirectory() as tmpdir:
        with ThreadPoolExecutor(workers) as ex:
            outs = list(ex.map(lambda p: run_chunk(driver, args, p[1], p[0], tmpdir), enumerate(parts)))
        with open(dest, "w") as fo:
            header_done = False
            for o in outs:
                with open(o) as fi:
                    header = fi.readline()
                    if not header_done:
                        fo.write(header)
                        header_done = True
                    for line in fi:
                        fo.write(line)
    print(f"wrote {dest} from {len(parts)} chunks ({len(lines)} compositions)")


if __name__ == "__main__":
    main()
