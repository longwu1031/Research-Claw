import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Segmented, Space, Tag, Tooltip, Typography, Dropdown } from 'antd';
import {
  BookOutlined,
  EllipsisOutlined,
  FilePdfOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { List as VirtualList } from 'react-window';
import { useLibraryStore, type Paper, type ReadStatus } from '../../stores/library';
import { getThemeTokens } from '../../styles/theme';
import { useConfigStore } from '../../stores/config';

// react-window v2 row component for virtual list
interface VirtualRowProps {
  papers: Paper[];
  tokens: ReturnType<typeof getThemeTokens>;
}

function VirtualRow(props: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
} & VirtualRowProps) {
  const { index, style, papers, tokens } = props;
  return (
    <div style={style}>
      <PaperListItem paper={papers[index]} tokens={tokens} />
    </div>
  );
}

const { Text } = Typography;

const STATUS_COLORS: Record<ReadStatus, string> = {
  unread: '#71717A',
  reading: '#3B82F6',
  read: '#22C55E',
  reviewed: '#A855F7',
};

function StatusBadge({ status }: { status: ReadStatus }) {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status];
  const isFilled = status === 'read' || status === 'reviewed';
  const isHalf = status === 'reading';

  return (
    <Tooltip title={t(`library.readStatus.${status}`)}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
          backgroundColor: isFilled ? color : isHalf ? `${color}66` : 'transparent',
          flexShrink: 0,
          marginTop: 5,
        }}
      />
    </Tooltip>
  );
}

interface PaperListItemProps {
  paper: Paper;
  tokens: ReturnType<typeof getThemeTokens>;
}

function PaperListItem({ paper, tokens }: PaperListItemProps) {
  const { t } = useTranslation();
  const updatePaperStatus = useLibraryStore((s) => s.updatePaperStatus);
  const ratePaper = useLibraryStore((s) => s.ratePaper);

  const authorsText = useMemo(() => {
    if (!paper.authors?.length) return '';
    if (paper.authors.length <= 3) return paper.authors.join(', ');
    return `${paper.authors.slice(0, 3).join(', ')}, +${paper.authors.length - 3}`;
  }, [paper.authors]);

  const visibleTags = paper.tags?.slice(0, 3) ?? [];
  const extraTagCount = (paper.tags?.length ?? 0) - 3;

  const menuItems = [
    { key: 'openPdf', label: t('library.paperActions.openPdf'), icon: <FilePdfOutlined /> },
    { key: 'cite', label: t('library.paperActions.cite') },
    { key: 'remove', label: t('library.paperActions.remove'), danger: true },
    { key: 'editTags', label: t('library.paperActions.editTags') },
  ];

  const statusCycleOrder: ReadStatus[] = ['unread', 'reading', 'read', 'reviewed'];

  const handleStatusClick = () => {
    const currentIndex = statusCycleOrder.indexOf(paper.status);
    const nextStatus = statusCycleOrder[(currentIndex + 1) % statusCycleOrder.length];
    updatePaperStatus(paper.id, nextStatus);
  };

  const handleStarClick = () => {
    ratePaper(paper.id, paper.rating ? 0 : 5);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '8px 16px',
        cursor: 'pointer',
        borderBottom: `1px solid ${tokens.border.default}`,
      }}
    >
      <div onClick={handleStatusClick} style={{ cursor: 'pointer', paddingTop: 2 }}>
        <StatusBadge status={paper.status} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: tokens.text.primary,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {paper.title}
        </Text>

        <div style={{ fontSize: 12, color: tokens.text.secondary, marginTop: 2 }}>
          {authorsText}
          {paper.year ? ` \u00B7 ${paper.year}` : ''}
        </div>

        {paper.venue && (
          <div style={{ fontSize: 12, color: tokens.text.muted, marginTop: 1 }}>
            {paper.venue}
          </div>
        )}

        {visibleTags.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {visibleTags.map((tag) => (
              <Tag key={tag} style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px' }}>
                {tag}
              </Tag>
            ))}
            {extraTagCount > 0 && (
              <Tag style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px' }}>
                +{extraTagCount}
              </Tag>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Button
          type="text"
          size="small"
          onClick={handleStarClick}
          icon={
            paper.rating ? (
              <StarFilled style={{ color: tokens.accent.amber, fontSize: 14 }} />
            ) : (
              <StarOutlined style={{ color: tokens.text.muted, fontSize: 14 }} />
            )
          }
          style={{ padding: 0, width: 24, height: 24 }}
        />
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<EllipsisOutlined style={{ color: tokens.text.muted, fontSize: 14 }} />}
            style={{ padding: 0, width: 24, height: 24 }}
          />
        </Dropdown>
      </div>
    </div>
  );
}

export default function LibraryPanel() {
  const { t } = useTranslation();
  const theme = useConfigStore((s) => s.theme);
  const tokens = useMemo(() => getThemeTokens(theme), [theme]);

  const papers = useLibraryStore((s) => s.papers);
  const loading = useLibraryStore((s) => s.loading);
  const total = useLibraryStore((s) => s.total);
  const activeTab = useLibraryStore((s) => s.activeTab);
  const setActiveTab = useLibraryStore((s) => s.setActiveTab);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const loadPapers = useLibraryStore((s) => s.loadPapers);
  const loadTags = useLibraryStore((s) => s.loadTags);
  const tags = useLibraryStore((s) => s.tags);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(400);

  useEffect(() => {
    loadPapers();
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedTags]);

  useEffect(() => {
    if (!listContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
      }
    });
    observer.observe(listContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadPapers();
      }, 300);
    },
    [setSearchQuery, loadPapers],
  );

  const handleTagToggle = useCallback(
    (tagName: string) => {
      setSelectedTags((prev) => {
        const next = prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName];
        return next;
      });
    },
    [],
  );

  // Filter papers by active tab
  const filteredPapers = useMemo(() => {
    if (activeTab === 'pending') {
      return papers.filter((p) => p.status === 'unread' || p.status === 'reading');
    }
    return papers;
  }, [papers, activeTab]);

  const pendingCount = useMemo(
    () => papers.filter((p) => p.status === 'unread' || p.status === 'reading').length,
    [papers],
  );

  const useVirtualScroll = filteredPapers.length > 50;

  // Empty state
  if (!loading && papers.length === 0 && !searchQuery) {
    return (
      <div style={{ padding: 24, textAlign: 'center', paddingTop: 60 }}>
        <BookOutlined style={{ fontSize: 48, color: tokens.text.muted, opacity: 0.4 }} />
        <div style={{ marginTop: 16, whiteSpace: 'pre-line' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('library.empty')}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tabs */}
      <div style={{ padding: '8px 16px' }}>
        <Segmented
          value={activeTab}
          onChange={(v) => setActiveTab(v as 'pending' | 'saved')}
          options={[
            { label: `${t('library.pending')} (${pendingCount})`, value: 'pending' },
            { label: `${t('library.saved')} (${total})`, value: 'saved' },
          ]}
          block
          size="small"
        />
      </div>

      {/* Search */}
      <div style={{ padding: '4px 16px 8px' }}>
        <Input
          prefix={<SearchOutlined style={{ color: tokens.text.muted }} />}
          placeholder={t('library.search')}
          value={searchQuery}
          onChange={handleSearchChange}
          allowClear
          size="small"
        />
      </div>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tags.slice(0, 10).map((tag) => (
            <Tag
              key={tag.name}
              color={selectedTags.includes(tag.name) ? tokens.accent.blue : undefined}
              onClick={() => handleTagToggle(tag.name)}
              style={{ cursor: 'pointer', fontSize: 11 }}
            >
              {tag.name}
            </Tag>
          ))}
        </div>
      )}

      {/* Paper list */}
      <div ref={listContainerRef} style={{ flex: 1, overflow: useVirtualScroll ? 'hidden' : 'auto' }}>
        {useVirtualScroll ? (
          <VirtualList
            rowComponent={VirtualRow}
            rowCount={filteredPapers.length}
            rowHeight={80}
            rowProps={{ papers: filteredPapers, tokens }}
            style={{ height: listHeight }}
          />
        ) : (
          filteredPapers.map((paper) => (
            <PaperListItem key={paper.id} paper={paper} tokens={tokens} />
          ))
        )}
      </div>
    </div>
  );
}
