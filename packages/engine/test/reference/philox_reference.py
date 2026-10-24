# Independent reference for random protocol v1, used only to derive the
# application vectors in ../random.cases.ts and ../draws.cases.ts. Written
# from the Random123 philox.h round structure with Python's arbitrary-precision
# integers; it asserts the Random123 known-answer vectors on import.
# Run: python3 -I packages/engine/test/reference/philox_reference.py
M0, M1, W0, W1 = 0xD2511F53, 0xCD9E8D57, 0x9E3779B9, 0xBB67AE85
MASK = 0xFFFFFFFF


def philox(ctr, key):
    c = list(ctr)
    k = list(key)
    for r in range(10):
        if r:
            k = [(k[0] + W0) & MASK, (k[1] + W1) & MASK]
        p0 = M0 * c[0]
        p1 = M1 * c[2]
        c = [(p1 >> 32) ^ c[1] ^ k[0], p1 & MASK, (p0 >> 32) ^ c[3] ^ k[1], p0 & MASK]
    return c


KAT = [
    ([0] * 4, [0, 0], [0x6627E8D5, 0xE169C58D, 0xBC57AC4C, 0x9B00DBD8]),
    ([MASK] * 4, [MASK] * 2, [0x408F276D, 0x41C83B0E, 0xA20BC7C6, 0x6D5451FD]),
    ([0x243F6A88, 0x85A308D3, 0x13198A2E, 0x03707344], [0xA4093822, 0x299F31D0], [0xD16CFE09, 0x94FDCCEB, 0x5001E420, 0x24126EA1]),
]
for c, k, o in KAT:
    assert philox(c, k) == o


class Stream:
    def __init__(s, key, session, block=0, lane=0):
        s.key, s.session, s.block, s.lane = key, session, block, lane

    def u32(s):
        out = philox([s.block & MASK, s.block >> 32] + s.session, s.key)[s.lane]
        s.lane += 1
        if s.lane == 4:
            s.lane = 0
            s.block += 1
        return out

    def uniform(s, n):
        lim = (2**32 // n) * n
        while True:
            x = s.u32()
            if x < lim:
                return x % n


SUITS = 'CDHS'
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']


def deck(decks):
    return [f'{d}{s}{r}' for d in range(decks) for s in SUITS for r in RANKS]


def shuffle(st, items):
    a = list(items)
    for i in range(len(a) - 1, 0, -1):
        j = st.uniform(i + 1)
        a[i], a[j] = a[j], a[i]
    return a


if __name__ == '__main__':
    import json
    zero = dict(key=[0, 0], session=[0, 0])
    pi = dict(key=[0xA4093822, 0x299F31D0], session=[0x13198A2E, 0x03707344])
    out = {}
    s = Stream(**zero)
    out['zero8'] = [s.u32() for _ in range(8)]
    s = Stream(**zero, block=0xFFFFFFFF, lane=3)
    out['carry'] = [s.u32(), s.u32(), s.block, s.lane]
    s = Stream(**pi)
    out['dice'] = [[s.uniform(6) + 1, s.uniform(6) + 1] for _ in range(5)]
    out['dicepos'] = [s.block, s.lane]
    s = Stream(**pi)
    out['single'] = [s.uniform(37) for _ in range(10)]
    s = Stream(**pi)
    out['double'] = [s.uniform(38) for _ in range(10)]
    s = Stream(**pi)
    sh = shuffle(s, deck(1))
    out['shuffle1'] = sh
    out['shuffle1pos'] = [s.block, s.lane]
    s = Stream(**pi)
    sh6 = shuffle(s, deck(6))
    out['shuffle6first10'] = sh6[:10]
    out['shuffle6last'] = sh6[-1]
    out['shuffle6pos'] = [s.block, s.lane]
    s = Stream(**zero)
    out['bounded'] = {}
    for n in [1, 2, 3, 10, 52, 2**31 + 1, 3 * 2**30, 2**32 - 1, 2**32]:
        s = Stream(**zero)
        out['bounded'][str(n)] = [[s.uniform(n) for _ in range(4)], [s.block, s.lane]]
    print(json.dumps(out))
