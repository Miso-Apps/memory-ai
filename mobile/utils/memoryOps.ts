export type MemoryType = 'text' | 'voice' | 'link' | 'photo' | 'rich';

export interface MemoryLike {
    type: MemoryType;
}

export interface MemoryTypeCounts {
    all: number;
    text: number;
    voice: number;
    link: number;
    photo: number;
}

export function buildMemoryTypeCounts(memories: MemoryLike[]): MemoryTypeCounts {
    const counts: MemoryTypeCounts = {
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

export function filterMemoriesByType<T extends MemoryLike>(
    memories: T[],
    filter: 'all' | MemoryType,
): T[] {
    if (filter === 'all') return memories;
    return memories.filter((memory) => memory.type === filter);
}
