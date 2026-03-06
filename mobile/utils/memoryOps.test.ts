import { buildMemoryTypeCounts, filterMemoriesByType, MemoryLike } from './memoryOps';

describe('memoryOps', () => {
    const sample: MemoryLike[] = [
        { type: 'text' },
        { type: 'voice' },
        { type: 'text' },
        { type: 'link' },
        { type: 'photo' },
        { type: 'voice' },
    ];

    it('builds type counts in one pass', () => {
        expect(buildMemoryTypeCounts(sample)).toEqual({
            all: 6,
            text: 2,
            voice: 2,
            link: 1,
            photo: 1,
        });
    });

    it('returns original reference for all filter', () => {
        const filtered = filterMemoriesByType(sample, 'all');
        expect(filtered).toBe(sample);
    });

    it('filters by specific memory type', () => {
        const filtered = filterMemoriesByType(sample, 'voice');
        expect(filtered).toHaveLength(2);
        expect(filtered.every((item) => item.type === 'voice')).toBe(true);
    });

    it('handles empty list', () => {
        expect(buildMemoryTypeCounts([])).toEqual({
            all: 0,
            text: 0,
            voice: 0,
            link: 0,
            photo: 0,
        });
        expect(filterMemoriesByType([], 'text')).toEqual([]);
    });
});
