# Rich Mixed-Media Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users compose a single memory from multiple ordered blocks of text, image, voice, and link — in any combination and any order.

**Architecture:** Add a `blocks` JSONB column to the `memories` table and a new `MemoryType.RICH = "rich"` enum value. The mobile capture screen is refactored to a block-list model: each block is independently renderable and removable. Single-type memories keep their existing API shape for full backward compatibility; multi-block memories use `type='rich'` and the `blocks` array.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), React Native/Expo/TypeScript (mobile), PostgreSQL/JSONB, react-i18next (i18n)

---

## Block Data Model

Each element of `blocks` is a JSON object:

```json
// text block
{ "type": "text",  "order_index": 0, "content": "My thought here" }

// image block
{ "type": "image", "order_index": 1, "image_url": "https://...", "thumbnail_url": "https://...", "caption": "optional caption" }

// voice block
{ "type": "voice", "order_index": 2, "audio_url": "https://...", "transcription": "...", "duration": 30 }

// link block
{ "type": "link",  "order_index": 3, "url": "https://..." }
```

For `type='rich'` memories, `content` (the top-level field) holds the **concatenation of all text + transcription blocks**, used for embedding and search.

---

## File Map

### Backend (modify existing)
| File | Change |
|------|--------|
| `backend/app/models/memory.py` | Add `MemoryType.RICH`, add `blocks` JSONB column |
| `backend/app/schemas/__init__.py` | Add `MemoryBlock` Pydantic model; extend `MemoryCreate`, `MemoryResponse`, `MemoryType` enum |
| `backend/app/api/memories.py` | Save `blocks` in `create_memory`; include `blocks` in `_to_dict` |
| `backend/app/services/ai_service.py` | Handle `'rich'` in `generate_summary` type hint dict |

### Backend (new file)
| File | Change |
|------|--------|
| `backend/migrate_rich_blocks.sql` | Idempotent SQL migration: add `RICH` enum value + `blocks` column |

### Mobile (modify existing)
| File | Change |
|------|--------|
| `mobile/services/api.ts` | Add `MemoryBlock` and `RichBlock` interfaces; extend `Memory`, `CreateMemoryDto` |
| `mobile/app/capture.tsx` | Replace single-attachment state with `blocks[]` array; new block renderers; updated `handleSave` |
| `mobile/i18n/locales/en.ts` | New i18n keys for block UI |
| `mobile/i18n/locales/vi.ts` | Vietnamese translations for same keys |

---

## Task 1: SQL Migration File

**Files:**
- Create: `backend/migrate_rich_blocks.sql`

- [ ] **Step 1.1: Create the migration file**

```sql
-- Migration: Add RICH memory type and blocks column
-- Run with: docker exec -i memoryai-postgres psql -U memoryai -d memoryai < migrate_rich_blocks.sql

-- Add 'rich' to the memorytype enum if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'rich'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'memorytype')
    ) THEN
        ALTER TYPE memorytype ADD VALUE 'rich';
    END IF;
END
$$;

-- Add blocks column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'memories' AND column_name = 'blocks'
    ) THEN
        ALTER TABLE memories ADD COLUMN blocks JSONB;
    END IF;
END
$$;

-- Index for queries that filter on rich-type memories
CREATE INDEX IF NOT EXISTS idx_memories_blocks_gin ON memories USING GIN (blocks)
    WHERE blocks IS NOT NULL;
```

- [ ] **Step 1.2: Apply the migration against the local Docker database**

```bash
docker exec -i memory-ai-postgres psql -U memoryai -d memoryai < backend/migrate_rich_blocks.sql
```

Expected output:
```
DO
DO
CREATE INDEX
```

- [ ] **Step 1.3: Verify columns and enum values exist**

```bash
docker exec -i memory-ai-postgres psql -U memoryai -d memoryai -c "\d memories" | grep blocks
docker exec -i memory-ai-postgres psql -U memoryai -d memoryai -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'memorytype');"
```

Expected: `blocks` column present, `rich` in enum values.

- [ ] **Step 1.4: Commit**

```bash
git add backend/migrate_rich_blocks.sql
git commit -m "feat(db): add RICH memory type enum and blocks JSONB column migration"
```

---

## Task 2: Backend Model Update

**Files:**
- Modify: `backend/app/models/memory.py:25` (MemoryType enum)
- Modify: `backend/app/models/memory.py:60-70` (Memory columns)

- [ ] **Step 2.1: Add RICH to MemoryType enum in the model**

In `backend/app/models/memory.py`, find the `MemoryType` class and add `RICH`:

```python
class MemoryType(str, enum.Enum):
    """Memory type enum"""

    TEXT = "text"
    LINK = "link"
    VOICE = "voice"
    PHOTO = "photo"
    RICH = "rich"  # ← add this line
```

- [ ] **Step 2.2: Add `blocks` column to the Memory model**

After the `image_url` line (around line 68), add:

```python
    # Rich mixed-media blocks (ordered array of {type, order_index, ...})
    blocks = Column(JSONB, nullable=True)
```

- [ ] **Step 2.3: Verify model loads without errors**

```bash
cd backend && source venv/bin/activate
python -c "from app.models.memory import Memory, MemoryType; print(MemoryType.RICH)"
```

Expected: `MemoryType.RICH`

- [ ] **Step 2.4: Commit**

```bash
git add backend/app/models/memory.py
git commit -m "feat(model): add RICH enum value and blocks JSONB column to Memory"
```

---

## Task 3: Backend Schema Update

**Files:**
- Modify: `backend/app/schemas/__init__.py`

- [ ] **Step 3.1: Write a test for the new schema**

In `backend/test_endpoints.py` (or a new `test_rich_memory.py`), add:

```python
def test_memory_create_rich_schema():
    from app.schemas import MemoryCreate, MemoryBlock, MemoryType

    block1 = MemoryBlock(type="text", order_index=0, content="Hello")
    block2 = MemoryBlock(type="image", order_index=1, image_url="https://x.com/a.jpg")
    mem = MemoryCreate(type=MemoryType.RICH, content="Hello", blocks=[block1, block2])
    assert mem.type == MemoryType.RICH
    assert len(mem.blocks) == 2
    assert mem.blocks[0].content == "Hello"
    assert mem.blocks[1].image_url == "https://x.com/a.jpg"
```

- [ ] **Step 3.2: Run test to confirm it fails**

```bash
cd backend && source venv/bin/activate
pytest test_endpoints.py::test_memory_create_rich_schema -v
```

Expected: ImportError or AttributeError (MemoryBlock doesn't exist yet).

- [ ] **Step 3.3: Add `MemoryBlock` Pydantic model and update `MemoryType` enum**

In `backend/app/schemas/__init__.py`, make these changes:

1. Add `RICH = "rich"` to the `MemoryType` enum:
```python
class MemoryType(str, Enum):
    TEXT = "text"
    LINK = "link"
    VOICE = "voice"
    PHOTO = "photo"
    RICH = "rich"  # ← add this line
```

2. Add `MemoryBlock` class **before** `MemoryCreate`:
```python
class MemoryBlock(BaseModel):
    """One block within a rich mixed-media memory."""

    type: str = Field(..., description="'text' | 'image' | 'voice' | 'link'")
    order_index: int = Field(..., ge=0)
    # text
    content: Optional[str] = Field(None, max_length=50000)
    # image
    image_url: Optional[str] = Field(None, max_length=512)
    thumbnail_url: Optional[str] = Field(None, max_length=512)
    caption: Optional[str] = Field(None, max_length=2000)
    # voice
    audio_url: Optional[str] = Field(None, max_length=512)
    transcription: Optional[str] = Field(None, max_length=50000)
    duration: Optional[int] = None  # seconds
    # link
    url: Optional[str] = Field(None, max_length=512)
```

3. Add `blocks` field to `MemoryCreate`:
```python
class MemoryCreate(BaseModel):
    type: MemoryType
    content: str = Field("", max_length=50000)
    metadata: Optional[dict] = None
    # Voice-specific
    transcription: Optional[str] = Field(None, max_length=50000)
    audio_url: Optional[str] = Field(None, max_length=512)
    audio_duration: Optional[int] = None
    # Photo-specific
    image_url: Optional[str] = Field(None, max_length=512)
    # Rich multi-block
    blocks: Optional[List[MemoryBlock]] = None  # ← add this line
```

4. Add `blocks` field to `MemoryResponse`:
```python
class MemoryResponse(BaseModel):
    # ... existing fields ...
    blocks: Optional[List[MemoryBlock]] = None  # ← add this line
```

- [ ] **Step 3.4: Run the schema test to confirm it passes**

```bash
cd backend && source venv/bin/activate
pytest test_endpoints.py::test_memory_create_rich_schema -v
```

Expected: PASS.

- [ ] **Step 3.5: Run full test suite to confirm no regressions**

```bash
cd backend && source venv/bin/activate
pytest -x --tb=short
```

Expected: All existing tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add backend/app/schemas/__init__.py
git commit -m "feat(schema): add MemoryBlock, RICH type, and blocks field to MemoryCreate/Response"
```

---

## Task 4: Backend API Update

**Files:**
- Modify: `backend/app/api/memories.py`

- [ ] **Step 4.1: Update `_to_dict` to include blocks**

Find the `_to_dict` function (around line 117) and add `blocks` to the result dict:

```python
def _to_dict(m: Memory, category_info: dict = None) -> dict:
    result = {
        # ... all existing fields ...
        "blocks": m.blocks if m.blocks else None,  # ← add this line
    }
    # ... rest of function unchanged ...
```

Place this line after `"updated_at": m.updated_at.isoformat() if m.updated_at else None,`.

- [ ] **Step 4.2: Update `create_memory` to save blocks**

Find where `m = Memory(...)` is constructed in `create_memory` (around line 335). Add `blocks=` to the constructor:

```python
    m = Memory(
        user_id=current_user.id,
        type=memory.type,
        content=memory.content,
        transcription=memory.transcription,
        audio_url=memory.audio_url,
        audio_duration=memory.audio_duration,
        image_url=memory.image_url,
        extra_metadata=metadata,
        blocks=[b.model_dump() for b in memory.blocks] if memory.blocks else None,  # ← add this line
    )
```

- [ ] **Step 4.3: For RICH type memories, derive `content` from blocks if not provided**

In `create_memory`, just before `m = Memory(...)`, add a block to derive content for RICH memories:

```python
    # For RICH memories, derive content from all text/transcription blocks for AI embedding
    if mem_type == "rich" and memory.blocks and not memory.content.strip():
        text_parts = [
            b.content or b.transcription or b.url or ""
            for b in sorted(memory.blocks, key=lambda x: x.order_index)
            if b.content or b.transcription or b.url
        ]
        memory = memory.model_copy(update={"content": "\n\n".join(text_parts)})
```

> **Note:** `memory.model_copy(update=...)` is the Pydantic v2 way. If using Pydantic v1, use `memory.copy(update=...)`.
>
> Check the Pydantic version: `python -c "import pydantic; print(pydantic.VERSION)"`. If v1, use `.copy()`; if v2, use `.model_copy()`.

- [ ] **Step 4.4: Write an integration test for creating a RICH memory**

In `backend/test_endpoints.py`, add (after checking existing test structure):

```python
def test_create_rich_memory(client, auth_headers):
    payload = {
        "type": "rich",
        "content": "hello",
        "blocks": [
            {"type": "text", "order_index": 0, "content": "hello"},
            {"type": "image", "order_index": 1, "image_url": "https://example.com/img.jpg"},
        ],
    }
    resp = client.post("/memories/", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "rich"
    assert data["blocks"] is not None
    assert len(data["blocks"]) == 2
    assert data["blocks"][0]["content"] == "hello"
```

- [ ] **Step 4.5: Run integration test**

```bash
cd backend && source venv/bin/activate
pytest test_endpoints.py::test_create_rich_memory -v
```

Expected: PASS.

- [ ] **Step 4.6: Run full test suite**

```bash
cd backend && source venv/bin/activate
pytest -x --tb=short
```

Expected: All tests pass.

- [ ] **Step 4.7: Commit**

```bash
git add backend/app/api/memories.py
git commit -m "feat(api): save and return blocks for RICH memories"
```

---

## Task 5: Backend AI Service Update

**Files:**
- Modify: `backend/app/services/ai_service.py:51` (generate_summary type hints)

- [ ] **Step 5.1: Add `'rich'` type hint to `generate_summary`**

Find the `type_hints` dict in `generate_summary` (around line 76) and add an entry:

```python
        type_hints = {
            "text": "a personal note",
            "voice": "a voice memo (transcription)",
            "link": "a saved web link / URL",
            "rich": "a mixed-media note with text, images, and/or voice",  # ← add this line
        }
```

- [ ] **Step 5.2: Verify no test regressions**

```bash
cd backend && source venv/bin/activate
pytest -x --tb=short
```

- [ ] **Step 5.3: Commit**

```bash
git add backend/app/services/ai_service.py
git commit -m "feat(ai): handle 'rich' memory type in summary generation"
```

---

## Task 6: Mobile API Types

**Files:**
- Modify: `mobile/services/api.ts:161` (`Memory` interface)
- Modify: `mobile/services/api.ts:250` (`CreateMemoryDto` interface)

- [ ] **Step 6.1: Add `MemoryBlock` interface and update `Memory`**

In `mobile/services/api.ts`, just before `export interface Memory {` (line 161), add:

```typescript
export interface MemoryBlock {
  type: 'text' | 'image' | 'voice' | 'link';
  order_index: number;
  // text
  content?: string;
  // image
  image_url?: string | null;
  thumbnail_url?: string | null;
  caption?: string;
  // voice
  audio_url?: string | null;
  transcription?: string | null;
  duration?: number;
  // link
  url?: string;
}
```

In the `Memory` interface, add the `blocks` field and extend the `type` union:

```typescript
export interface Memory {
  id: string;
  user_id: string;
  type: 'text' | 'link' | 'voice' | 'photo' | 'rich';  // ← add 'rich'
  content: string;
  transcription?: string;
  audio_url?: string;
  audio_duration?: number;
  image_url?: string;
  ai_summary?: string;
  metadata?: Record<string, any>;
  blocks?: MemoryBlock[] | null;  // ← add this field
  category_id?: string;
  // ... rest unchanged
}
```

- [ ] **Step 6.2: Update `CreateMemoryDto`**

Update the `type` union and add `blocks`:

```typescript
export interface CreateMemoryDto {
  type: 'text' | 'link' | 'voice' | 'photo' | 'rich';  // ← add 'rich'
  content: string;
  metadata?: Record<string, any>;
  transcription?: string;
  audio_url?: string;
  audio_duration?: number;
  image_url?: string;
  blocks?: MemoryBlock[];  // ← add this field
}
```

- [ ] **Step 6.3: Type-check**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 6.4: Commit**

```bash
git add mobile/services/api.ts
git commit -m "feat(api-types): add MemoryBlock interface and rich type support"
```

---

## Task 7: i18n Keys

**Files:**
- Modify: `mobile/i18n/locales/en.ts`
- Modify: `mobile/i18n/locales/vi.ts`

- [ ] **Step 7.1: Add English keys to `capture` section**

In `mobile/i18n/locales/en.ts`, inside the `capture: {` block, add these keys at the end (before the closing `}`):

```typescript
    // Rich/block editor
    addTextBlock: 'Add text',
    addImageBlock: 'Add image',
    addVoiceBlock: 'Record audio',
    addLinkBlock: 'Add link',
    removeBlock: 'Remove block',
    textBlockPlaceholder: 'Continue your thought…',
    linkBlockPlaceholder: 'Paste a URL…',
    voiceBlockRecording: 'Recording…',
    voiceBlockUploading: 'Processing…',
    imageCaptionPlaceholder: 'Add a caption… (optional)',
```

- [ ] **Step 7.2: Add Vietnamese keys to `capture` section**

In `mobile/i18n/locales/vi.ts`, add the same keys with Vietnamese values:

```typescript
    // Rich/block editor
    addTextBlock: 'Thêm văn bản',
    addImageBlock: 'Thêm hình ảnh',
    addVoiceBlock: 'Ghi âm',
    addLinkBlock: 'Thêm liên kết',
    removeBlock: 'Xóa khối',
    textBlockPlaceholder: 'Tiếp tục suy nghĩ của bạn…',
    linkBlockPlaceholder: 'Dán URL vào đây…',
    voiceBlockRecording: 'Đang ghi âm…',
    voiceBlockUploading: 'Đang xử lý…',
    imageCaptionPlaceholder: 'Thêm chú thích… (không bắt buộc)',
```

- [ ] **Step 7.3: Verify i18n parity**

```bash
cd mobile && npm run i18n:check
```

Expected: parity passed (no missing keys).

- [ ] **Step 7.4: Commit**

```bash
git add mobile/i18n/locales/en.ts mobile/i18n/locales/vi.ts
git commit -m "feat(i18n): add EN/VI keys for rich block editor"
```

---

## Task 8: Mobile Capture Screen — Block Model

**Files:**
- Modify: `mobile/app/capture.tsx` (top of file, new interfaces + state)

This task introduces the TypeScript block interfaces and replaces the flat state with a `blocks` array. The screen will temporarily lose the voice/image/link UI until Task 9 re-adds them as block renderers.

- [ ] **Step 8.1: Define TypeScript block interfaces**

At the top of `capture.tsx`, after the existing `interface VoiceData { ... }` block (around line 115), add:

```typescript
// ── Block types ──────────────────────────────────────────────────────────────

export type LocalBlockType = 'text' | 'image' | 'voice' | 'link';

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  imageUrl: string | null;
  thumbnailUrl: string | null;
  caption: string;
  uploading: boolean;
}

export interface VoiceBlock {
  id: string;
  type: 'voice';
  audioUrl: string | null;
  transcription: string | null;
  duration: number;
}

export interface LinkBlock {
  id: string;
  type: 'link';
  url: string;
  error: string;
}

export type LocalBlock = TextBlock | ImageBlock | VoiceBlock | LinkBlock;

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}
```

- [ ] **Step 8.2: Replace flat state with blocks array in `CaptureScreen`**

In the `export default function CaptureScreen()` body, replace all existing content/voice/image/link state variables with:

```typescript
  // ── Block state ──────────────────────────────────────────────────────────
  const [blocks, setBlocks] = useState<LocalBlock[]>([
    { id: genId(), type: 'text', content: '' },
  ]);

  // Recording is global — only one voice clip at a time
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'uploading'>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

Keep the following existing state (they are not block-specific):
- `isSaving`, `setSaveSuccess`, `saveSuccess`, `successOpacity`, `successScale`
- `reduceMotionEnabled`
- `clipboardUrl`, `clipSaving`, `clipOpacity`

Remove (they are now replaced by blocks):
- `content`, `setContent`
- `voiceStatus`, `setVoiceStatus`, `voiceDuration`, `setVoiceDuration`, `voiceData`, `setVoiceData`
- `imageData`, `setImageData`, `photoNote`, `setPhotoNote`
- `linkVisible`, `setLinkVisible`, `linkContent`, `setLinkContent`, `linkError`, `setLinkError`

- [ ] **Step 8.3: Add block mutation helpers**

After the state declarations, add these helper functions:

```typescript
  const updateBlock = (id: string, patch: Partial<LocalBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } as LocalBlock : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      const filtered = prev.filter((b) => b.id !== id);
      // Always keep at least one text block
      if (filtered.length === 0) return [{ id: genId(), type: 'text', content: '' }];
      return filtered;
    });
  };

  const addBlock = (block: LocalBlock) => {
    setBlocks((prev) => [...prev, block]);
  };
```

- [ ] **Step 8.4: Run type-check to confirm block types compile**

```bash
cd mobile && npm run type-check 2>&1 | head -30
```

There will likely be errors because the old state variables are still referenced in the render/handler code — that's expected at this stage. Confirm the block-type declarations themselves are clean (no red squiggles on the new interfaces/functions).

- [ ] **Step 8.5: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): introduce LocalBlock TypeScript interfaces and block state"
```

---

## Task 9: Mobile Capture Screen — Voice + Image Handlers

**Files:**
- Modify: `mobile/app/capture.tsx` (voice recording, image pick/upload functions)

- [ ] **Step 9.1: Rewrite `startVoiceRecording` to create a pending voice block**

Replace the existing `startVoiceRecording` function:

```typescript
  const startVoiceRecording = async () => {
    try {
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(t('capture.permissionRequired'), t('capture.microphonePermission'));
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(OPTIMIZED_RECORDING_OPTIONS);
      recordingRef.current = recording;
      setRecordingStatus('recording');
      setRecordingDuration(0);
      timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      Alert.alert(t('capture.recordingError'), t('capture.recordingErrorMessage'));
    }
  };
```

- [ ] **Step 9.2: Rewrite `stopVoiceRecording` to push a completed VoiceBlock**

Replace the existing `stopVoiceRecording` function:

```typescript
  const stopVoiceRecording = async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const finalDuration = recordingDuration;
    setRecordingStatus('uploading');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');
      const result = await storageApi.uploadAudio(uri);
      // Push a completed voice block onto the blocks array
      addBlock({
        id: genId(),
        type: 'voice',
        audioUrl: result.audio_url ?? null,
        transcription: result.transcription ?? null,
        duration: finalDuration,
      });
    } catch (err) {
      console.error('stopVoiceRecording error:', err);
      // Push a partial voice block even on failure
      addBlock({
        id: genId(),
        type: 'voice',
        audioUrl: null,
        transcription: null,
        duration: finalDuration,
      });
    } finally {
      setRecordingStatus('idle');
    }
  };
```

- [ ] **Step 9.3: Rewrite `pickImage` to push an ImageBlock**

Replace the existing `pickImage` function:

```typescript
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionRequired'), t('capture.photoLibraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    let optimizedUri = asset.uri;
    try {
      const optimized = await optimizeImage(asset.uri);
      optimizedUri = optimized.uri;
    } catch { /* use original */ }

    // Insert an uploading placeholder block
    const blockId = genId();
    addBlock({ id: blockId, type: 'image', imageUrl: null, thumbnailUrl: null, caption: '', uploading: true });

    try {
      const uploadResult = await storageApi.uploadImage(optimizedUri);
      updateBlock(blockId, {
        imageUrl: uploadResult.image_url ?? null,
        thumbnailUrl: uploadResult.thumbnail_url ?? null,
        uploading: false,
      });
    } catch (err) {
      console.error('Image upload error:', err);
      removeBlock(blockId);
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    }
  };
```

- [ ] **Step 9.4: Add cleanup effect for recording on unmount**

Replace the existing cleanup `useEffect` that cleans up the recording timer:

```typescript
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);
```

(This is largely the same as before — keep it.)

- [ ] **Step 9.5: Run type-check**

```bash
cd mobile && npm run type-check 2>&1 | head -30
```

There will still be errors from unused old state references in the render function — that's expected. No new type errors should appear in functions added in this task.

- [ ] **Step 9.6: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): block-based voice and image handlers"
```

---

## Task 10: Mobile Capture Screen — Block Renderers

**Files:**
- Modify: `mobile/app/capture.tsx` (new `BlockRenderer` component + updated `ComposerRow`)

- [ ] **Step 10.1: Create a `VoiceBlockWidget` component**

Add this component after `VoiceWidget` (around line 200):

```tsx
interface VoiceBlockWidgetProps {
  block: VoiceBlock;
  onRemove: () => void;
}

function VoiceBlockWidget({ block, onRemove }: VoiceBlockWidgetProps) {
  const { colors } = useTheme();
  const fmtDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={[widgetStyles.pill, { backgroundColor: 'rgba(232,132,74,0.10)', borderColor: 'rgba(232,132,74,0.35)', marginTop: 8 }]}>
      <Mic size={12} color={colors.captureAccent} strokeWidth={2.2} />
      <Text style={[widgetStyles.pillText, { color: colors.captureAccent }]}>
        {block.transcription
          ? block.transcription.slice(0, 40) + (block.transcription.length > 40 ? '…' : '')
          : fmtDuration(block.duration)}
      </Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={12} color={colors.captureMuted} strokeWidth={2.2} />
      </TouchableOpacity>
    </View>
  );
}
```

- [ ] **Step 10.2: Create an `ImageBlockWidget` component**

Add after `ImageWidget`:

```tsx
interface ImageBlockWidgetProps {
  block: ImageBlock;
  onRemove: () => void;
  onChangeCaption: (v: string) => void;
}

function ImageBlockWidget({ block, onRemove, onChangeCaption }: ImageBlockWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (block.uploading) {
    return (
      <View style={[imgWidgetStyles.thumb, { backgroundColor: colors.captureCard, borderColor: colors.captureBorder, marginTop: 10 }]}>
        <ActivityIndicator color={colors.captureAccent} />
        <Text style={[imgWidgetStyles.uploadingText, { color: colors.captureMuted }]}>{t('capture.analyzingImage')}</Text>
      </View>
    );
  }

  const uri = block.thumbnailUrl || block.imageUrl;
  if (!uri) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <View style={imgWidgetStyles.thumbWrap}>
        <Image source={{ uri }} style={imgWidgetStyles.thumb} resizeMode="cover" />
        <TouchableOpacity style={imgWidgetStyles.removeBtn} onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={12} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <TextInput
        style={[composerStyles.photoNote, { color: colors.captureText, borderColor: colors.captureBorder, fontFamily: 'DMSans_400Regular', marginTop: 6 }]}
        placeholder={t('capture.imageCaptionPlaceholder')}
        placeholderTextColor={colors.captureMuted}
        multiline
        value={block.caption}
        onChangeText={onChangeCaption}
        textAlignVertical="top"
      />
    </View>
  );
}
```

> **Note:** This references `composerStyles.photoNote` which is defined lower in the file. Move the `composerStyles` StyleSheet declaration above the component definitions if there is a reference error.

- [ ] **Step 10.3: Create a `LinkBlockWidget` component**

Add after `ImageBlockWidget`:

```tsx
interface LinkBlockWidgetProps {
  block: LinkBlock;
  onChangeUrl: (v: string) => void;
  onRemove: () => void;
}

function LinkBlockWidget({ block, onChangeUrl, onRemove }: LinkBlockWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[composerStyles.linkInputWrapper, { marginTop: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          style={[composerStyles.linkInput, { flex: 1, color: colors.captureText, borderColor: block.error ? colors.error : colors.captureBorder, fontFamily: 'DMSans_400Regular' }]}
          placeholder={t('capture.linkBlockPlaceholder')}
          placeholderTextColor={colors.captureMuted}
          value={block.url}
          onChangeText={onChangeUrl}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color={colors.captureMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      {!!block.error && (
        <Text style={[composerStyles.linkError, { color: colors.error }]}>{block.error}</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 10.4: Create a `TextBlockWidget` component**

Add before `ComposerRow`:

```tsx
interface TextBlockWidgetProps {
  block: TextBlock;
  isFirst: boolean;
  onChange: (v: string) => void;
}

function TextBlockWidget({ block, isFirst, onChange }: TextBlockWidgetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <TextInput
      style={[composerStyles.input, { color: colors.captureText, fontFamily: 'DMSans_400Regular' }]}
      placeholder={isFirst ? t('capture.composerPlaceholder') : t('capture.textBlockPlaceholder')}
      placeholderTextColor={colors.captureMuted}
      multiline
      autoFocus={isFirst}
      value={block.content}
      onChangeText={onChange}
      textAlignVertical="top"
      autoCapitalize="sentences"
      autoCorrect
    />
  );
}
```

- [ ] **Step 10.5: Update `ComposerRow` to render a `blocks` list**

Replace the `ComposerRowProps` interface and `ComposerRow` component with:

```tsx
interface ComposerRowProps {
  blocks: LocalBlock[];
  onUpdateBlock: (id: string, patch: Partial<LocalBlock>) => void;
  onRemoveBlock: (id: string) => void;
  onSelectHint: (label: string) => void;
  // Recording (global, only one at a time)
  recordingStatus: 'idle' | 'recording' | 'uploading';
  recordingDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  // Clipboard
  clipboardUrl: string | null;
  clipOpacity: Animated.Value;
  clipSaving: boolean;
  onQuickSaveLink: () => void;
  onUseClipboardUrl: () => void;
  onDismissClipboard: () => void;
  // Attachment actions
  onAddImage: () => void;
  onAddLink: () => void;
  // Threads-layout
  username: string;
}

function ComposerRow({
  blocks, onUpdateBlock, onRemoveBlock, onSelectHint,
  recordingStatus, recordingDuration, onStartRecording, onStopRecording,
  clipboardUrl, clipOpacity, clipSaving, onQuickSaveLink, onUseClipboardUrl, onDismissClipboard,
  onAddImage, onAddLink,
  username,
}: ComposerRowProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();

  const initial = username.charAt(0).toUpperCase();
  const textBlocks = blocks.filter((b): b is TextBlock => b.type === 'text');
  const showChips =
    textBlocks.length === 1 &&
    textBlocks[0].content.length === 0 &&
    blocks.length === 1 &&
    recordingStatus === 'idle';

  return (
    <View style={composerStyles.row}>

      {/* ── Avatar column ── */}
      <View style={composerStyles.avatarCol}>
        <LinearGradient
          colors={['#F2B67E', '#C2600A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={composerStyles.avatarCircle}
        >
          <Text style={composerStyles.avatarInitial}>{initial}</Text>
        </LinearGradient>
        <View style={composerStyles.threadWrapper}>
          <View style={[composerStyles.threadLine, { backgroundColor: isDark ? 'rgba(232,132,74,0.2)' : 'rgba(194,96,10,0.12)' }]} />
          <View style={[composerStyles.threadNode, { backgroundColor: colors.captureAccent }]} />
          <View style={[composerStyles.threadLineFlex, { backgroundColor: isDark ? 'rgba(232,132,74,0.1)' : 'rgba(194,96,10,0.07)' }]} />
        </View>
      </View>

      {/* ── Content column ── */}
      <View style={composerStyles.contentCol}>

        {/* Author row */}
        <View style={composerStyles.authorRow}>
          <Text style={[composerStyles.authorName, { color: colors.captureText }]}>{username}</Text>
          <Text style={[composerStyles.authorTime, { color: colors.captureMuted }]}>{t('capture.justNow')}</Text>
        </View>

        {/* Render each block in order */}
        {blocks.map((block, idx) => {
          if (block.type === 'text') {
            return (
              <TextBlockWidget
                key={block.id}
                block={block}
                isFirst={idx === 0}
                onChange={(v) => onUpdateBlock(block.id, { content: v } as Partial<TextBlock>)}
              />
            );
          }
          if (block.type === 'image') {
            return (
              <ImageBlockWidget
                key={block.id}
                block={block}
                onRemove={() => onRemoveBlock(block.id)}
                onChangeCaption={(v) => onUpdateBlock(block.id, { caption: v } as Partial<ImageBlock>)}
              />
            );
          }
          if (block.type === 'voice') {
            return (
              <VoiceBlockWidget
                key={block.id}
                block={block}
                onRemove={() => onRemoveBlock(block.id)}
              />
            );
          }
          if (block.type === 'link') {
            return (
              <LinkBlockWidget
                key={block.id}
                block={block}
                onChangeUrl={(v) => onUpdateBlock(block.id, { url: v, error: '' } as Partial<LinkBlock>)}
                onRemove={() => onRemoveBlock(block.id)}
              />
            );
          }
          return null;
        })}

        {/* Global recording indicator (while recording, not yet a block) */}
        {recordingStatus === 'recording' && (
          <VoiceWidget
            status="recording"
            duration={recordingDuration}
            transcription={null}
            onStop={onStopRecording}
            onDiscard={onStopRecording}
          />
        )}
        {recordingStatus === 'uploading' && (
          <VoiceWidget
            status="uploading"
            duration={recordingDuration}
            transcription={null}
            onStop={() => {}}
            onDiscard={() => {}}
          />
        )}

        {/* Hint chips */}
        {showChips && <HintChips onSelect={onSelectHint} />}

        {/* Clipboard URL banner */}
        {clipboardUrl ? (
          <Animated.View style={[composerStyles.clipCard, { opacity: clipOpacity, backgroundColor: colors.subtleBg, borderColor: colors.captureBorder }]}>
            <View style={composerStyles.clipLeft}>
              <Link2 size={13} color={colors.brandAccent} strokeWidth={2.4} />
              <View style={{ flex: 1 }}>
                <Text style={[composerStyles.clipTitle, { color: colors.captureMuted }]}>{t('capture.clipboardDetected')}</Text>
                <Text style={[composerStyles.clipUrl, { color: colors.brandAccent }]} numberOfLines={1}>{clipboardUrl}</Text>
              </View>
            </View>
            <View style={composerStyles.clipActions}>
              <TouchableOpacity onPress={onQuickSaveLink} disabled={clipSaving} style={[composerStyles.clipSaveBtn, { backgroundColor: colors.brandAccent }]}>
                {clipSaving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={composerStyles.clipSaveText}>{t('capture.quickSave')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={onUseClipboardUrl} style={[composerStyles.clipUseBtn, { borderColor: colors.brandAccent }]}>
                <Text style={[composerStyles.clipUseText, { color: colors.brandAccent }]}>{t('capture.useLink')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDismissClipboard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={colors.captureMuted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : null}

        {/* ── Attachment icon row ── */}
        <View style={[composerStyles.attachmentDivider, { borderTopColor: colors.captureBorder }]}>
          <View style={composerStyles.attachmentRow}>
            <TouchableOpacity
              onPress={onAddImage}
              disabled={recordingStatus !== 'idle'}
              style={{ opacity: recordingStatus !== 'idle' ? 0.3 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={t('capture.toolbarImageA11y')}
            >
              <ImageIcon size={20} color={colors.captureMuted} strokeWidth={1.8} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={recordingStatus === 'recording' ? onStopRecording : onStartRecording}
              style={{ opacity: 1 }}
              accessibilityRole="button"
              accessibilityLabel={t('capture.toolbarVoiceA11y')}
            >
              <Mic
                size={20}
                color={recordingStatus !== 'idle' ? colors.captureAccent : colors.captureMuted}
                strokeWidth={recordingStatus !== 'idle' ? 2.4 : 1.8}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onAddLink}
              disabled={recordingStatus !== 'idle'}
              style={{ opacity: recordingStatus !== 'idle' ? 0.3 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={t('capture.toolbarLinkA11y')}
            >
              <Link2 size={20} color={colors.captureMuted} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </View>
  );
}
```

- [ ] **Step 10.6: Run type-check**

```bash
cd mobile && npm run type-check 2>&1 | head -50
```

Fix any type errors before proceeding.

- [ ] **Step 10.7: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): block renderers - TextBlockWidget, ImageBlockWidget, VoiceBlockWidget, LinkBlockWidget"
```

---

## Task 11: Mobile Capture Screen — Main Screen & Save Logic

**Files:**
- Modify: `mobile/app/capture.tsx` (CaptureScreen component: handlers, save, render)

- [ ] **Step 11.1: Rewrite `handleSave` to serialize blocks**

Replace the existing `handleSave` function:

```typescript
  const handleSave = async () => {
    // Validate: any link blocks must have a valid URL
    for (const block of blocks) {
      if (block.type === 'link') {
        const url = (block as LinkBlock).url.trim();
        if (!url) {
          updateBlock(block.id, { error: t('capture.linkError') } as Partial<LinkBlock>);
          return;
        }
        if (!/^https?:\/\/.+/i.test(url)) {
          updateBlock(block.id, { error: t('capture.linkError') } as Partial<LinkBlock>);
          return;
        }
        updateBlock(block.id, { error: '' } as Partial<LinkBlock>);
      }
    }

    setIsSaving(true);
    try {
      await _doSave();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaveSuccess(true);
      if (reduceMotionEnabled) {
        successOpacity.setValue(1);
        successScale.setValue(1);
        setTimeout(() => router.back(), 600);
      } else {
        Animated.parallel([
          Animated.timing(successOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.spring(successScale, { toValue: 1, friction: 6, useNativeDriver: true }),
        ]).start(() => setTimeout(() => router.back(), 600));
      }
    } catch (error) {
      if (handleDuplicateLinkError(error)) return;
      Alert.alert(t('capture.error'), t('capture.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const _doSave = async () => {
    const textBlocks = blocks.filter((b): b is TextBlock => b.type === 'text');
    const voiceBlocks = blocks.filter((b): b is VoiceBlock => b.type === 'voice');
    const imageBlocks = blocks.filter((b): b is ImageBlock => b.type === 'image');
    const linkBlocks = blocks.filter((b): b is LinkBlock => b.type === 'link');

    const isRich =
      blocks.length > 1 ||
      (voiceBlocks.length > 0 && textBlocks.some((b) => b.content.trim())) ||
      (imageBlocks.length > 0 && textBlocks.some((b) => b.content.trim())) ||
      (imageBlocks.length > 0 && voiceBlocks.length > 0);

    if (isRich) {
      // Multi-block: send as RICH with blocks array
      const combinedContent = [
        ...textBlocks.map((b) => b.content),
        ...voiceBlocks.filter((b) => b.transcription).map((b) => b.transcription!),
      ]
        .filter(Boolean)
        .join('\n\n')
        .trim() || '…';

      await memoriesApi.create({
        type: 'rich',
        content: combinedContent,
        blocks: blocks.map((b, i) => {
          const base = { type: b.type, order_index: i };
          if (b.type === 'text') return { ...base, content: (b as TextBlock).content };
          if (b.type === 'image') return { ...base, image_url: (b as ImageBlock).imageUrl ?? undefined, thumbnail_url: (b as ImageBlock).thumbnailUrl ?? undefined, caption: (b as ImageBlock).caption };
          if (b.type === 'voice') return { ...base, audio_url: (b as VoiceBlock).audioUrl ?? undefined, transcription: (b as VoiceBlock).transcription ?? undefined, duration: (b as VoiceBlock).duration };
          if (b.type === 'link') return { ...base, url: (b as LinkBlock).url };
          return base;
        }),
      });
    } else if (voiceBlocks.length === 1 && voiceBlocks[0].audioUrl) {
      // Single voice
      const v = voiceBlocks[0];
      await memoriesApi.create({
        type: 'voice',
        content: v.transcription || t('capture.voiceNote'),
        transcription: v.transcription ?? undefined,
        audio_url: v.audioUrl ?? undefined,
        audio_duration: v.duration,
      });
    } else if (imageBlocks.length === 1 && imageBlocks[0].imageUrl) {
      // Single image
      const img = imageBlocks[0];
      const photoMetadata: Record<string, unknown> = {};
      if (img.caption.trim()) photoMetadata.user_note = img.caption.trim();
      if (img.thumbnailUrl) photoMetadata.thumbnail_url = img.thumbnailUrl;
      await memoriesApi.create({
        type: 'photo',
        content: img.caption.trim() || t('capture.imageNote'),
        image_url: img.imageUrl ?? undefined,
        metadata: Object.keys(photoMetadata).length > 0 ? photoMetadata : undefined,
      });
    } else if (linkBlocks.length === 1) {
      // Single link
      await memoriesApi.create({ type: 'link', content: linkBlocks[0].url.trim() });
    } else {
      // Single text (or empty text blocks only)
      const text = textBlocks.map((b) => b.content).join('\n').trim();
      await memoriesApi.create({ type: 'text', content: text });
    }
  };
```

- [ ] **Step 11.2: Update `canSave` to use blocks**

Replace the existing `canSave` derived variable:

```typescript
  const isVoiceRecording = recordingStatus !== 'idle';
  const canSave =
    !isVoiceRecording &&
    blocks.some((b) => {
      if (b.type === 'text') return (b as TextBlock).content.trim().length > 0;
      if (b.type === 'image') return !!(b as ImageBlock).imageUrl && !(b as ImageBlock).uploading;
      if (b.type === 'voice') return !!(b as VoiceBlock).audioUrl;
      if (b.type === 'link') return /^https?:\/\/.+/i.test((b as LinkBlock).url.trim());
      return false;
    });
```

- [ ] **Step 11.3: Add `handleAddLink` helper**

After `pickImage`, add:

```typescript
  const handleAddLink = () => {
    addBlock({ id: genId(), type: 'link', url: '', error: '' });
  };
```

- [ ] **Step 11.4: Update `useClipboardUrl` to push a link block**

Replace `useClipboardUrl`:

```typescript
  const useClipboardUrl = () => {
    if (!clipboardUrl) return;
    addBlock({ id: genId(), type: 'link', url: clipboardUrl, error: '' });
    dismissClipboard();
  };
```

- [ ] **Step 11.5: Update the `ComposerRow` call in the render to use new props**

Find the `<ComposerRow ...>` JSX in the render and update to match the new interface:

```tsx
          <ComposerRow
            blocks={blocks}
            onUpdateBlock={updateBlock}
            onRemoveBlock={removeBlock}
            onSelectHint={(label) => {
              const firstText = blocks.find((b): b is TextBlock => b.type === 'text');
              if (firstText) {
                updateBlock(firstText.id, {
                  content: firstText.content ? `${label} ${firstText.content}` : `${label} `,
                } as Partial<TextBlock>);
              }
            }}
            recordingStatus={recordingStatus}
            recordingDuration={recordingDuration}
            onStartRecording={startVoiceRecording}
            onStopRecording={stopVoiceRecording}
            clipboardUrl={clipboardUrl}
            clipOpacity={clipOpacity}
            clipSaving={clipSaving}
            onQuickSaveLink={handleQuickSaveLink}
            onUseClipboardUrl={useClipboardUrl}
            onDismissClipboard={dismissClipboard}
            onAddImage={pickImage}
            onAddLink={handleAddLink}
            username={username}
          />
```

- [ ] **Step 11.6: Update `charCount` in the bottom bar**

The bottom bar `charCount` should now show total characters across all text blocks:

```tsx
          <Text style={[styles.charCount, { color: totalChars > 450 ? colors.warning : colors.captureBorder }]}>
            {500 - totalChars}
          </Text>
```

And add this derived variable above the return:

```typescript
  const totalChars = blocks
    .filter((b): b is TextBlock => b.type === 'text')
    .reduce((sum, b) => sum + b.content.length, 0);
```

- [ ] **Step 11.7: Update the deep-link mode bootstrap effect**

Find the `useEffect` that bootstraps based on `params.mode` and update:

```typescript
  useEffect(() => {
    if (params.mode === 'link') handleAddLink();
    if (params.mode === 'voice') startVoiceRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 11.8: Run type-check**

```bash
cd mobile && npm run type-check
```

Expected: 0 errors.

- [ ] **Step 11.9: Run lint**

```bash
cd mobile && npm run lint
```

Expected: 0 errors.

- [ ] **Step 11.10: Run i18n parity check**

```bash
cd mobile && npm run i18n:check
```

Expected: parity passed.

- [ ] **Step 11.11: Commit**

```bash
git add mobile/app/capture.tsx
git commit -m "feat(capture): block-based save logic, canSave, and handlers for rich memories"
```

---

## Task 12: Smoke Test End-to-End

- [ ] **Step 12.1: Start backend and mobile (iOS)**

```bash
./scripts/dev.sh --ios
```

- [ ] **Step 12.2: In the app, test single text capture**

1. Open capture screen
2. Type "Hello world"
3. Tap Save
4. Verify: new memory appears in list, `type=text`

- [ ] **Step 12.3: Test single image capture**

1. Open capture screen
2. Tap image icon → pick a photo
3. Tap Save
4. Verify: `type=photo`, image visible in detail

- [ ] **Step 12.4: Test single voice capture**

1. Open capture screen
2. Tap mic → record a few seconds → tap mic again to stop
3. Tap Save
4. Verify: `type=voice`, audio pill visible

- [ ] **Step 12.5: Test rich multi-block capture**

1. Open capture screen
2. Type "Text block one"
3. Tap image icon → pick a photo
4. Audio recording → tap mic → record → stop
5. Tap Save
6. Verify: memory saved, `type=rich`, `blocks` has 3 entries

- [ ] **Step 12.6: Verify backend returns blocks**

```bash
# Get a token from the login endpoint, then:
curl -H "Authorization: Bearer <token>" http://localhost:8000/memories/?limit=5 | python -m json.tool | grep -A5 '"type": "rich"'
```

Expected: rich memory has `"blocks": [...]`.

- [ ] **Step 12.7: Final validation**

```bash
cd backend && source venv/bin/activate && pytest -x --tb=short
cd mobile && npm run type-check && npm run lint && npm run i18n:check
```

All expected to pass.

- [ ] **Step 12.8: Final commit**

```bash
git add -A
git commit -m "feat: rich mixed-media memories - text+image+voice+link blocks in any order"
```

---

## Deployment Notes

After merging:
1. **Run migration** on production DB: `docker exec -i memoryai-postgres psql -U memoryai -d memoryai < backend/migrate_rich_blocks.sql`
2. **Deploy backend** with updated model + API
3. **No env var changes** needed
4. **Mobile app store release** needed for the new capture UI (OTA update via Expo should work for JS-only changes)

Existing memories (all `type != 'rich'`) are **unaffected** — the `blocks` column is `nullable` and old memories simply return `blocks: null`.

---

## What We Are NOT Doing (scope limits)

- **Drag-to-reorder blocks** — blocks are ordered by insertion; reordering is a future enhancement
- **Multiple link blocks fetching preview cards** — link blocks store raw URL only; rich previews are a future enhancement
- **Editing rich memories** — the detail/edit screen is out of scope for this PR; rich memories will show blocks as read-only until a follow-up
- **Search within blocks** — semantic search already works via the concatenated `content` field
