/**
 * The circuit-connect puzzle bank, ported from the electrician job so every
 * script can use it.
 *
 * Each puzzle is stored as its full SOLUTION — one cell path per pair — not
 * just the endpoints. The game only shows the endpoints, but authoring the
 * paths means a layout cannot ship unsolvable: the test suite walks every path
 * and proves continuity, disjointness and non-trivial endpoints.
 */

export type Cell = [number, number];

export type ConnectPuzzle = {
    size: number;
    /** One solution path per pair; the first and last cells are the dots. */
    paths: Cell[][];
};

export const CONNECT_PUZZLES: ConnectPuzzle[] = [
    // 3 pairs, 5x5
    {
        size: 5,
        paths: [
            [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1], [4, 2]],
            [[0, 1], [0, 2], [0, 3], [1, 3], [1, 2], [1, 1], [2, 1], [2, 2], [2, 3]],
            [[3, 1], [3, 2], [3, 3], [3, 4], [2, 4], [1, 4], [0, 4]],
        ],
    },
    {
        size: 5,
        paths: [
            [[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [3, 0], [4, 0]],
            [[0, 2], [0, 3], [0, 4], [1, 4], [1, 3], [1, 2], [2, 2], [2, 1]],
            [[2, 3], [2, 4], [3, 4], [3, 3], [3, 2], [3, 1], [4, 1], [4, 2], [4, 3], [4, 4]],
        ],
    },

    // 4 pairs, 5x5
    {
        size: 5,
        paths: [
            [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
            [[0, 1], [0, 2], [0, 3], [0, 4], [1, 4]],
            [[1, 1], [1, 2], [1, 3], [2, 3], [2, 2], [2, 1], [3, 1], [3, 2], [3, 3]],
            [[4, 1], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4]],
        ],
    },
    {
        size: 5,
        paths: [
            [[0, 0], [0, 1], [0, 2], [1, 2], [1, 1], [1, 0], [2, 0]],
            [[0, 3], [0, 4], [1, 4], [1, 3], [2, 3], [2, 4], [3, 4]],
            [[2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4]],
            [[4, 0], [3, 0], [3, 1], [4, 1], [4, 2]],
        ],
    },
    {
        size: 5,
        paths: [
            [[0, 0], [0, 1], [0, 2]],
            [[1, 0], [2, 0], [3, 0], [4, 0], [4, 1]],
            [[1, 1], [1, 2], [1, 3], [0, 3], [0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [3, 1]],
            [[3, 2], [4, 2], [4, 3], [3, 3], [3, 4], [4, 4]],
        ],
    },

    // 4 pairs, 6x6
    {
        size: 6,
        paths: [
            [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2]],
            [[0, 1], [0, 2], [0, 3], [1, 3], [1, 2], [1, 1], [2, 1], [2, 2], [2, 3], [3, 3], [3, 2], [3, 1], [4, 1], [4, 2], [4, 3]],
            [[0, 4], [0, 5], [1, 5], [1, 4], [2, 4], [2, 5], [3, 5], [3, 4], [4, 4], [4, 5]],
            [[5, 3], [5, 4], [5, 5]],
        ],
    },

    // 5 pairs, 5x5
    {
        size: 5,
        paths: [
            [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2]],
            [[0, 3], [0, 4], [1, 4], [1, 3], [1, 2]],
            [[2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [2, 1], [2, 2]],
            [[3, 2], [4, 2], [4, 3], [4, 4], [3, 4]],
            [[3, 3], [2, 3], [2, 4]],
        ],
    },

    // 5 pairs, 6x6
    {
        size: 6,
        paths: [
            [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 5]],
            [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1]],
            [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [3, 1], [3, 2], [3, 3], [3, 4]],
            [[4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [3, 5], [2, 5]],
            [[5, 2], [5, 3], [5, 4], [5, 5]],
        ],
    },
];

/** A random puzzle with this many pairs, falling back to the nearest count. */
export function pickPuzzle(pairs: number): ConnectPuzzle {
    const exact = CONNECT_PUZZLES.filter((puzzle) => puzzle.paths.length === pairs);
    const pool = exact.length ? exact : CONNECT_PUZZLES;

    return pool[Math.floor(Math.random() * pool.length)];
}
