import { performance } from 'node:perf_hooks';

const TYPES = ['text', 'voice', 'link', 'photo'];

function buildDataset(size) {
    const items = new Array(size);
    for (let i = 0; i < size; i += 1) {
        items[i] = { type: TYPES[i % TYPES.length] };
    }
    return items;
}

function baselineCounts(memories) {
    return {
        all: memories.length,
        text: memories.filter((m) => m.type === 'text').length,
        voice: memories.filter((m) => m.type === 'voice').length,
        link: memories.filter((m) => m.type === 'link').length,
        photo: memories.filter((m) => m.type === 'photo').length,
    };
}

function optimizedCounts(memories) {
    const counts = {
        all: memories.length,
        text: 0,
        voice: 0,
        link: 0,
        photo: 0,
    };

    for (const memory of memories) {
        if (memory.type === 'text') counts.text += 1;
        else if (memory.type === 'voice') counts.voice += 1;
        else if (memory.type === 'link') counts.link += 1;
        else if (memory.type === 'photo') counts.photo += 1;
    }

    return counts;
}

function timeIt(fn, data, rounds = 200) {
    const started = performance.now();
    for (let i = 0; i < rounds; i += 1) {
        fn(data);
    }
    return performance.now() - started;
}

const size = Number(process.env.MEMORY_BENCH_SIZE ?? 10000);
const rounds = Number(process.env.MEMORY_BENCH_ROUNDS ?? 200);
const dataset = buildDataset(size);

const baselineMs = timeIt(baselineCounts, dataset, rounds);
const optimizedMs = timeIt(optimizedCounts, dataset, rounds);
const improvement = ((baselineMs - optimizedMs) / baselineMs) * 100;

console.log('Memory ops benchmark');
console.log(`dataset=${size} rounds=${rounds}`);
console.log(`baseline(multi-filter): ${baselineMs.toFixed(2)}ms`);
console.log(`optimized(single-pass): ${optimizedMs.toFixed(2)}ms`);
console.log(`improvement: ${improvement.toFixed(2)}%`);
