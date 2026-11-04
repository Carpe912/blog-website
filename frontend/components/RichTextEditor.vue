<script setup lang="ts">
/**
 * RichTextEditor — 类飞书文档的富文本编辑器
 *
 * 基于 Tiptap，输出 HTML 字符串。
 * 通过 v-model 双向绑定，SSR 环境下不会初始化编辑器（由父组件 ClientOnly 包裹）。
 */
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: '开始写作…' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const lowlight = createLowlight(common)

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    Image.configure({ inline: false, allowBase64: true }),
    Placeholder.configure({ placeholder: props.placeholder }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
  ],
  editorProps: {
    attributes: {
      class: 'rte-content prose-editor',
      spellcheck: 'false',
    },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

// 外部内容变化时同步（避免回写自身导致的抖动）
watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    if (value === editor.value.getHTML()) return
    editor.value.commands.setContent(value || '', false)
  },
)

onBeforeUnmount(() => editor.value?.destroy())

// ── 工具方法 ────────────────────────────────────────────────────────────────
const isActive = (...args: any[]) => editor.value?.isActive(...args) ?? false

function setLink() {
  if (!editor.value) return
  const previous = editor.value.getAttributes('link').href as string | undefined
  const url = window.prompt('链接地址', previous ?? 'https://')
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function addImage() {
  if (!editor.value) return
  const url = window.prompt('图片地址', 'https://')
  if (!url) return
  editor.value.chain().focus().setImage({ src: url }).run()
}

// ── 工具栏配置 ──────────────────────────────────────────────────────────────
interface Tool {
  key: string
  label: string
  icon: string // SVG path
  run: () => void
  active?: () => boolean
}

const groups: Tool[][] = [
  [
    {
      key: 'h1',
      label: '一级标题',
      icon: 'M4 6h16M4 12h10M4 18h6',
      run: () => editor.value?.chain().focus().toggleHeading({ level: 1 }).run(),
      active: () => isActive('heading', { level: 1 }),
    },
    {
      key: 'h2',
      label: '二级标题',
      icon: 'M4 6h16M4 12h8M4 18h5',
      run: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () => isActive('heading', { level: 2 }),
    },
    {
      key: 'h3',
      label: '三级标题',
      icon: 'M4 6h16M4 12h6M4 18h4',
      run: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(),
      active: () => isActive('heading', { level: 3 }),
    },
  ],
  [
    {
      key: 'bold',
      label: '加粗',
      icon: 'M7 5h6a4 4 0 010 8H7V5zm0 8h7a4 4 0 010 8H7v-8z',
      run: () => editor.value?.chain().focus().toggleBold().run(),
      active: () => isActive('bold'),
    },
    {
      key: 'italic',
      label: '斜体',
      icon: 'M19 4h-9M14 20H5M15 4L9 20',
      run: () => editor.value?.chain().focus().toggleItalic().run(),
      active: () => isActive('italic'),
    },
    {
      key: 'underline',
      label: '下划线',
      icon: 'M6 4v6a6 6 0 0012 0V4M4 20h16',
      run: () => editor.value?.chain().focus().toggleUnderline().run(),
      active: () => isActive('underline'),
    },
    {
      key: 'strike',
      label: '删除线',
      icon: 'M6 12h12M8 5h8a3 3 0 010 6H8M8 13h8a3 3 0 010 6H8',
      run: () => editor.value?.chain().focus().toggleStrike().run(),
      active: () => isActive('strike'),
    },
    {
      key: 'code',
      label: '行内代码',
      icon: 'M8 6l-6 6 6 6M16 6l6 6-6 6',
      run: () => editor.value?.chain().focus().toggleCode().run(),
      active: () => isActive('code'),
    },
    {
      key: 'highlight',
      label: '高亮',
      icon: 'M4 20h16M6 15l6-10 5 8-5 4-6-2z',
      run: () => editor.value?.chain().focus().toggleHighlight().run(),
      active: () => isActive('highlight'),
    },
  ],
  [
    {
      key: 'bulletList',
      label: '无序列表',
      icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
      run: () => editor.value?.chain().focus().toggleBulletList().run(),
      active: () => isActive('bulletList'),
    },
    {
      key: 'orderedList',
      label: '有序列表',
      icon: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2l-2 4h2',
      run: () => editor.value?.chain().focus().toggleOrderedList().run(),
      active: () => isActive('orderedList'),
    },
    {
      key: 'taskList',
      label: '待办',
      icon: 'M4 6h16M4 12h16M4 18h16M9 6l1.5 1.5L13 5',
      run: () => editor.value?.chain().focus().toggleTaskList().run(),
      active: () => isActive('taskList'),
    },
  ],
  [
    {
      key: 'blockquote',
      label: '引用',
      icon: 'M7 7h4v6a4 4 0 01-4 4M15 7h4v6a4 4 0 01-4 4',
      run: () => editor.value?.chain().focus().toggleBlockquote().run(),
      active: () => isActive('blockquote'),
    },
    {
      key: 'codeBlock',
      label: '代码块',
      icon: 'M4 5h16v14H4zM9 9l-2 3 2 3M15 9l2 3-2 3',
      run: () => editor.value?.chain().focus().toggleCodeBlock().run(),
      active: () => isActive('codeBlock'),
    },
    {
      key: 'horizontalRule',
      label: '分割线',
      icon: 'M4 12h16',
      run: () => editor.value?.chain().focus().setHorizontalRule().run(),
    },
    {
      key: 'table',
      label: '表格',
      icon: 'M4 5h16v14H4zM4 10h16M10 5v14',
      run: () =>
        editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      key: 'link',
      label: '链接',
      icon: 'M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1',
      run: setLink,
      active: () => isActive('link'),
    },
    {
      key: 'image',
      label: '图片',
      icon: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
      run: addImage,
    },
  ],
  [
    {
      key: 'alignLeft',
      label: '左对齐',
      icon: 'M4 6h16M4 12h10M4 18h13',
      run: () => editor.value?.chain().focus().setTextAlign('left').run(),
      active: () => isActive({ textAlign: 'left' }),
    },
    {
      key: 'alignCenter',
      label: '居中',
      icon: 'M4 6h16M7 12h10M6 18h12',
      run: () => editor.value?.chain().focus().setTextAlign('center').run(),
      active: () => isActive({ textAlign: 'center' }),
    },
    {
      key: 'undo',
      label: '撤销',
      icon: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10H9',
      run: () => editor.value?.chain().focus().undo().run(),
    },
    {
      key: 'redo',
      label: '重做',
      icon: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h6',
      run: () => editor.value?.chain().focus().redo().run(),
    },
  ],
]

// 字数统计
const wordCount = computed(() => {
  const text = editor.value?.getText() ?? ''
  return text.replace(/\s+/g, '').length
})
</script>

<template>
  <div class="rte-root">
    <!-- 工具栏 -->
    <div v-if="editor" class="rte-toolbar">
      <div v-for="(group, gi) in groups" :key="gi" class="rte-group">
        <span v-if="gi > 0" class="rte-sep" aria-hidden="true" />
        <button
          v-for="tool in group"
          :key="tool.key"
          type="button"
          class="rte-btn"
          :class="{ 'is-active': tool.active?.() }"
          :title="tool.label"
          :aria-label="tool.label"
          @click="tool.run()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
            stroke-linecap="round" stroke-linejoin="round">
            <path :d="tool.icon" />
          </svg>
        </button>
      </div>

      <div class="ml-auto hidden sm:flex items-center gap-3 pr-1 text-xs text-slate-400 dark:text-slate-500 tabular-nums">
        <span>{{ wordCount }} 字</span>
      </div>
    </div>

    <!-- 编辑区 -->
    <EditorContent :editor="editor" class="rte-body" />
  </div>
</template>

<style scoped>
.rte-root {
  @apply bg-white dark:bg-slate-900;
}

/* ── 工具栏 ───────────────────────────────────────────── */
.rte-toolbar {
  @apply sticky top-0 z-10 flex items-center gap-0.5 flex-wrap
         px-2 py-1.5 border-b border-slate-200/80 bg-white/90 backdrop-blur
         dark:border-slate-800 dark:bg-slate-900/90;
}
.rte-group {
  @apply flex items-center;
}
.rte-sep {
  @apply mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700;
}
.rte-btn {
  @apply flex h-8 w-8 items-center justify-center rounded-md text-slate-500
         transition-colors hover:bg-slate-100 hover:text-slate-900
         dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100;
}
.rte-btn svg {
  @apply h-[17px] w-[17px];
}
.rte-btn.is-active {
  @apply bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200;
}

/* ── 编辑区 ───────────────────────────────────────────── */
.rte-body {
  @apply px-0;
}

:deep(.ProseMirror) {
  @apply min-h-[72vh] outline-none;
  padding: 2rem 1.25rem 45vh;
  font-size: 1.0625rem;
  line-height: 1.85;
  color: theme('colors.slate.700');
}
:deep(.ProseMirror) > * + * {
  margin-top: 0.9em;
}

/* 标题 */
:deep(.ProseMirror h1) {
  @apply mt-10 mb-4 text-[1.9rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100;
}
:deep(.ProseMirror h2) {
  @apply mt-9 mb-3 text-[1.45rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100;
}
:deep(.ProseMirror h3) {
  @apply mt-7 mb-2 text-[1.18rem] font-semibold text-slate-900 dark:text-slate-100;
}
:deep(.ProseMirror h1:first-child),
:deep(.ProseMirror h2:first-child),
:deep(.ProseMirror h3:first-child) {
  @apply mt-0;
}

/* 段落与行内 */
:deep(.ProseMirror p) {
  @apply text-slate-700 dark:text-slate-300;
}
:deep(.ProseMirror strong) {
  @apply font-semibold text-slate-900 dark:text-slate-100;
}
:deep(.ProseMirror a) {
  @apply text-indigo-600 underline decoration-indigo-200 underline-offset-2
         hover:decoration-indigo-500 dark:text-indigo-400 dark:decoration-indigo-800;
}
:deep(.ProseMirror code) {
  @apply rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.86em]
         text-rose-600 dark:bg-slate-800 dark:text-rose-400;
}
:deep(.ProseMirror mark) {
  @apply rounded bg-amber-100 px-0.5 text-inherit dark:bg-amber-500/25;
}

/* 引用 */
:deep(.ProseMirror blockquote) {
  @apply border-l-[3px] border-slate-300 pl-5 text-slate-600 dark:border-slate-600 dark:text-slate-400;
}

/* 列表 */
:deep(.ProseMirror ul) {
  @apply list-disc pl-6;
}
:deep(.ProseMirror ol) {
  @apply list-decimal pl-6;
}
:deep(.ProseMirror li) {
  @apply my-1;
}
:deep(.ProseMirror li > p) {
  @apply my-0;
}

/* 待办列表 */
:deep(.ProseMirror ul[data-type='taskList']) {
  @apply list-none pl-1;
}
:deep(.ProseMirror ul[data-type='taskList'] li) {
  @apply flex items-start gap-2.5;
}
:deep(.ProseMirror ul[data-type='taskList'] li > label) {
  @apply mt-1.5 shrink-0;
}
:deep(.ProseMirror ul[data-type='taskList'] input[type='checkbox']) {
  @apply h-4 w-4 rounded border-slate-300 accent-slate-900 dark:accent-slate-200;
}

/* 代码块 */
:deep(.ProseMirror pre) {
  @apply overflow-x-auto rounded-xl bg-slate-900 px-5 py-4 text-[0.85rem] leading-relaxed
         text-slate-100 dark:bg-slate-950 dark:ring-1 dark:ring-slate-800;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
}
:deep(.ProseMirror pre code) {
  @apply bg-transparent p-0 text-inherit;
}

/* 表格 */
:deep(.ProseMirror table) {
  @apply w-full border-collapse overflow-hidden rounded-lg text-sm;
}
:deep(.ProseMirror th),
:deep(.ProseMirror td) {
  @apply border border-slate-200 px-3 py-2 align-top dark:border-slate-700;
}
:deep(.ProseMirror th) {
  @apply bg-slate-50 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200;
}

/* 图片与分割线 */
:deep(.ProseMirror img) {
  @apply rounded-xl;
}
:deep(.ProseMirror hr) {
  @apply my-10 border-slate-200 dark:border-slate-700;
}

/* 占位符 */
:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  @apply pointer-events-none float-left h-0 text-slate-300 dark:text-slate-600;
}

/* 选中文字的浮动菜单底色 */
:deep(.ProseMirror ::selection) {
  @apply bg-indigo-100 dark:bg-indigo-500/25;
}
</style>
