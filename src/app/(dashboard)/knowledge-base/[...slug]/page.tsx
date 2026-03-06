'use client';

import { use } from 'react';
import KnowledgeBaseArticlePage from '@/components/knowledge-base/KnowledgeBaseArticlePage';

export default function ArticlePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = use(params);
  return <KnowledgeBaseArticlePage slug={slug.join('/')} />;
}
