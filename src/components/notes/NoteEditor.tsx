'use client';

import { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExtension from '@tiptap/extension-image';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import CodeIcon from '@mui/icons-material/Code';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LinkIcon from '@mui/icons-material/Link';
import TitleIcon from '@mui/icons-material/Title';
import { palette } from '@/theme/palette';

interface NoteEditorProps {
  content: string;
  onChange: (html: string, plainText: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
}

export default function NoteEditor({
  content,
  onChange,
  readOnly = false,
  placeholder = 'Start writing your notes...',
  minHeight = 200,
  compact = false,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      LinkExtension.configure({
        openOnClick: true,
        autolink: true,
        HTMLAttributes: { style: `color: ${palette.info.main}; cursor: pointer;` },
      }),
      Placeholder.configure({ placeholder }),
      ImageExtension.configure({ inline: true }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const text = e.getText();
      onChange(html, text);
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; outline: none; padding: ${compact ? '8px' : '12px'}; color: ${palette.text.primary}; font-size: ${compact ? '0.8125rem' : '0.875rem'}; line-height: 1.6;`,
      },
    },
    immediatelyRender: false,
  });

  const handleLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({
    title,
    icon,
    isActive,
    onClick,
  }: {
    title: string;
    icon: React.ReactNode;
    isActive?: boolean;
    onClick: () => void;
  }) => (
    <Tooltip title={title} placement="top">
      <IconButton
        size="small"
        onClick={onClick}
        sx={{
          width: compact ? 26 : 30,
          height: compact ? 26 : 30,
          borderRadius: '4px',
          color: isActive ? palette.primary.main : palette.text.secondary,
          bgcolor: isActive ? `${palette.primary.main}15` : 'transparent',
          '&:hover': { bgcolor: `${palette.primary.main}10` },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  const iconSize = compact ? 16 : 18;

  return (
    <Box
      sx={{
        border: `1px solid ${palette.divider}`,
        borderRadius: '8px',
        bgcolor: palette.background.surface2,
        overflow: 'hidden',
        '& .tiptap': {
          '& p': { margin: '0 0 0.5em 0' },
          '& h1': { fontSize: '1.5em', fontWeight: 700, margin: '0.5em 0 0.3em' },
          '& h2': { fontSize: '1.25em', fontWeight: 600, margin: '0.5em 0 0.3em' },
          '& h3': { fontSize: '1.1em', fontWeight: 600, margin: '0.4em 0 0.2em' },
          '& ul, & ol': { paddingLeft: '1.5em', margin: '0.3em 0' },
          '& li': { marginBottom: '0.15em' },
          '& blockquote': {
            borderLeft: `3px solid ${palette.primary.main}`,
            paddingLeft: '1em',
            marginLeft: 0,
            color: palette.text.secondary,
            fontStyle: 'italic',
          },
          '& code': {
            bgcolor: palette.background.surface3,
            px: '4px',
            py: '1px',
            borderRadius: '3px',
            fontSize: '0.85em',
            fontFamily: 'monospace',
          },
          '& pre': {
            bgcolor: palette.background.default,
            padding: '12px',
            borderRadius: '6px',
            overflow: 'auto',
            '& code': { bgcolor: 'transparent', p: 0 },
          },
          '& img': { maxWidth: '100%', borderRadius: '4px' },
          '& a': { color: palette.info.main, textDecoration: 'underline' },
          '& .is-editor-empty:first-child::before': {
            content: 'attr(data-placeholder)',
            float: 'left',
            color: palette.text.disabled,
            pointerEvents: 'none',
            height: 0,
          },
        },
      }}
    >
      {!readOnly && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 1,
              py: 0.5,
              borderBottom: `1px solid ${palette.divider}`,
              bgcolor: palette.background.paper,
              flexWrap: 'wrap',
            }}
          >
            <ToolbarButton
              title="Heading 1"
              icon={<TitleIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            />
            <ToolbarButton
              title="Heading 2"
              icon={<TitleIcon sx={{ fontSize: iconSize - 2 }} />}
              isActive={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToolbarButton
              title="Bold"
              icon={<FormatBoldIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              title="Italic"
              icon={<FormatItalicIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              title="Strikethrough"
              icon={<StrikethroughSIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <ToolbarButton
              title="Code"
              icon={<CodeIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            />
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToolbarButton
              title="Bullet list"
              icon={<FormatListBulletedIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              title="Numbered list"
              icon={<FormatListNumberedIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              title="Blockquote"
              icon={<FormatQuoteIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToolbarButton
              title="Link"
              icon={<LinkIcon sx={{ fontSize: iconSize }} />}
              isActive={editor.isActive('link')}
              onClick={handleLink}
            />
          </Box>
        </>
      )}
      <EditorContent editor={editor} />
    </Box>
  );
}
