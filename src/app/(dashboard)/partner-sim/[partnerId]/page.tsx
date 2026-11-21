'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SyncIcon from '@mui/icons-material/Sync';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PageTransition from '@/components/animations/PageTransition';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import OrderBuilder from '@/components/partner-sim/OrderBuilder';
import OrdersTable from '@/components/partner-sim/OrdersTable';
import OrderDetailDrawer from '@/components/partner-sim/OrderDetailDrawer';
import WebhookEventsPanel from '@/components/partner-sim/WebhookEventsPanel';
import PrescribersPanel from '@/components/partner-sim/PrescribersPanel';
import ConnectionPanel from '@/components/partner-sim/ConnectionPanel';
import PartnerFormDialog from '@/components/partner-sim/PartnerFormDialog';
import { useAuth } from '@/components/providers/AuthProvider';
import type { EnvironmentInfo } from '@/lib/partner-sim/environments';
import { readError, type CallResult, type SimOrder, type SimPartner, type SimPrescriber } from '@/components/partner-sim/types';

type TabId = 'builder' | 'orders' | 'webhooks' | 'prescribers' | 'connection';

export default function PartnerSimDetailPage({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = use(params);
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();

  const [partner, setPartner] = useState<SimPartner | null>(null);
  const [environments, setEnvironments] = useState<EnvironmentInfo[]>([]);
  const [prescribers, setPrescribers] = useState<SimPrescriber[] | null>(null);
  const [orders, setOrders] = useState<SimOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('builder');
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ connection: CallResult; catalog: CallResult } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadPartner = useCallback(async () => {
    const res = await fetch(`/api/partner-sim/partners/${partnerId}`);
    if (res.ok) setPartner(await res.json());
    else setError(await readError(res));
  }, [partnerId]);

  const loadPrescribers = useCallback(async () => {
    const res = await fetch(`/api/partner-sim/partners/${partnerId}/prescribers`);
    setPrescribers(res.ok ? await res.json() : []);
  }, [partnerId]);

  const loadOrders = useCallback(async () => {
    const res = await fetch(`/api/partner-sim/partners/${partnerId}/orders`);
    if (res.ok) setOrders(await res.json());
  }, [partnerId]);

  useEffect(() => {
    if (authLoading) return;
    loadPartner();
    loadPrescribers();
    loadOrders();
    fetch('/api/partner-sim/partners')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEnvironments(d.environments));
  }, [authLoading, loadPartner, loadPrescribers, loadOrders]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/partner-sim/partners/${partnerId}/sync`, { method: 'POST' });
      if (!res.ok) {
        setToast(await readError(res));
        return;
      }
      const data = (await res.json()) as { partner: SimPartner; calls: { connection: CallResult; catalog: CallResult } };
      setPartner((p) => (p ? { ...p, ...data.partner } : data.partner));
      setLastSync(data.calls);
      const { connection, catalog } = data.calls;
      if (connection.ok && catalog.ok) setToast('Connection and catalog synced');
      else {
        setToast(`Sync failed: connection ${connection.status ?? connection.error}, catalog ${catalog.status ?? catalog.error}`);
        setTab('connection');
      }
    } finally {
      setSyncing(false);
    }
  };

  const remove = async () => {
    const res = await fetch(`/api/partner-sim/partners/${partnerId}`, { method: 'DELETE' });
    if (res.ok) router.push('/partner-sim');
    else setToast(await readError(res));
  };

  const upsertOrder = useCallback((order: SimOrder) => {
    setOrders((prev) => {
      const i = prev.findIndex((o) => o.id === order.id);
      if (i === -1) return [order, ...prev];
      const next = [...prev];
      next[i] = order;
      return next;
    });
  }, []);

  if (error) {
    return (
      <Box>
        <Button component={Link} href="/partner-sim" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Partners
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (authLoading || !partner || prescribers === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const envLabel = environments.find((e) => e.id === partner.environment)?.label ?? partner.environment;

  return (
    <PageTransition>
      <Box>
        <Button component={Link} href="/partner-sim" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1 }}>
          Partners
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {partner.name}
          </Typography>
          <Chip label={envLabel} size="small" />
          <Chip label={`${partner.api_key_mode} key …${partner.api_key_last4}`} size="small" color={partner.api_key_mode === 'live' ? 'warning' : 'info'} variant="outlined" />
          {partner.connection?.status && <Chip label={`connection ${partner.connection.status}`} size="small" variant="outlined" />}
          <Box sx={{ flex: 1 }} />
          {partner.docs_url && (
            <Button size="small" startIcon={<MenuBookOutlinedIcon />} href={partner.docs_url} target="_blank" rel="noreferrer">
              API docs
            </Button>
          )}
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
          <Button variant="outlined" startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon />} onClick={sync} disabled={syncing}>
            Sync connection &amp; catalog
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {partner.api_url ? `${partner.api_url}/v1` : `No API URL configured for ${envLabel}`}
          {partner.connection?.pharmacyName ? ` · ${partner.connection.pharmacyName}` : ''}
          {partner.api_key_mode === 'test' ? ' · test key: every check runs and webhooks fire, but orders cancel themselves' : ''}
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="builder" label="Order builder" />
          <Tab value="orders" label={`Orders (${orders.length})`} />
          <Tab value="webhooks" label="Webhooks" />
          <Tab value="prescribers" label={`Prescribers (${prescribers.length})`} />
          <Tab value="connection" label="Connection & catalog" />
        </Tabs>

        {/* The builder stays mounted so a draft survives a look at another tab. */}
        <Box sx={{ display: tab === 'builder' ? 'block' : 'none' }}>
          <OrderBuilder
            partner={partner}
            prescribers={prescribers}
            orders={orders}
            onSubmitted={(o) => {
              upsertOrder(o);
              loadPrescribers();
            }}
            onOpenOrder={setOpenOrderId}
          />
        </Box>
        {tab === 'orders' && <OrdersTable orders={orders} onOpen={setOpenOrderId} onReload={loadOrders} />}
        {tab === 'webhooks' && <WebhookEventsPanel partner={partner} orders={orders} onOpenOrder={setOpenOrderId} />}
        {tab === 'prescribers' && <PrescribersPanel partner={partner} prescribers={prescribers} onChanged={loadPrescribers} />}
        {tab === 'connection' && <ConnectionPanel partner={partner} lastSync={lastSync} />}

        <OrderDetailDrawer
          orderId={openOrderId}
          onClose={() => setOpenOrderId(null)}
          onChanged={upsertOrder}
          onOpenOrder={setOpenOrderId}
        />

        <PartnerFormDialog
          open={editOpen}
          environments={environments}
          partner={partner}
          onClose={() => setEditOpen(false)}
          onSaved={() => loadPartner()}
        />
        <ConfirmDialog
          open={deleteOpen}
          title="Delete this test partner?"
          message="Removes the saved key, prescribers, sent orders and received webhooks from TCM. Nothing changes in FullStackRx."
          confirmLabel="Delete"
          destructive
          onConfirm={remove}
          onCancel={() => setDeleteOpen(false)}
        />
        <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)} message={toast} />
      </Box>
    </PageTransition>
  );
}
