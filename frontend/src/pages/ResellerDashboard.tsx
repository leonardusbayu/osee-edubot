import { useEffect, useState } from 'react';

const WORKER_BASE = 'https://edubot-api.edubot-leonardus.workers.dev';
const ADMIN_SECRET = (import.meta.env.VITE_ADMIN_SECRET as string) || '';

// tg_id is needed for auth (admin-api uses x-telegram-user-id header)
function getTelegramId(): string {
  try {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user?.id) return String(tg.initDataUnsafe.user.id);
  } catch {}
  return '';
}

async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const fullUrl = url.startsWith('/api') ? `${WORKER_BASE}${url}` : url;
  const tgId = getTelegramId();
  return fetch(fullUrl, {
    ...init,
    headers: {
      'x-admin-secret': ADMIN_SECRET,
      ...(tgId ? { 'x-telegram-user-id': tgId } : {}),
      ...(init?.headers || {}),
    },
  });
}

// ─── Types ──────────────────────────────────────────────────────
interface CodeRow {
  id: number;
  code: string;
  is_active: number;
  total_uses: number;
  total_revenue_stars: number;
  total_commission_stars: number;
  notes: string | null;
  created_at: string;
  share_link?: string;
}

interface CustomerRow {
  attribution_id: number;
  status: 'pending' | 'confirmed' | 'paid' | 'clawback';
  commission_amount_stars: number;
  commission_rate: number;
  plan_days: number;
  plan_amount_stars: number;
  confirmed_at: string | null;
  paid_at: string | null;
  purchase_date: string;
  customer_id: number;
  customer_name: string;
  customer_telegram_id: string;
  customer_target_test: string | null;
  customer_is_premium: number;
  customer_premium_until: string | null;
  last_test_date: string | null;
  total_attempts: number;
}

interface CustomersData {
  codes: CodeRow[];
  customers: CustomerRow[];
  reseller_id: number;
}

interface AttributionRow {
  id: number;
  status: 'pending' | 'confirmed' | 'paid' | 'clawback';
  commission_amount_stars: number;
  commission_rate: number;
  plan_days: number;
  plan_amount_stars: number;
  confirmed_at: string | null;
  paid_at: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  notes: string | null;
  created_at: string;
  customer_id: number;
  customer_name: string;
  code: string;
}

interface EarningsData {
  attributions: AttributionRow[];
  totals: Record<string, { count: number; stars: number }>;
  reseller_id: number;
}

interface WeekPoint {
  week: string;
  new_customers: number;
  revenue_stars: number;
  commission_stars: number;
}

interface ActivityData {
  weeks: WeekPoint[];
  reseller_id: number;
}

// Class comparison types
interface ClassRow {
  id: number;
  name: string;
  invite_code: string;
  is_active: number;
}

interface ClassStudent {
  id: number;
  name: string;
  telegram_id: string;
  referral_code_applied: string | null;
  target_test: string | null;
  in_class?: boolean;
  used_my_code?: boolean;
  class_id?: number;
}

interface ClassComparisonData {
  classes: ClassRow[];
  summary: {
    total_students: number;
    used_my_code: number;
    class_only: number;
    code_only: number;
    overlap: number;
  };
  overlap: ClassStudent[];
  class_only: ClassStudent[];
  code_only: ClassStudent[];
  message?: string;
}

// Message types
interface MessageHistoryRow {
  sent_at: string;
  broadcast_id: string;
  message_text: string;
  customer_id: number;
  customer_name: string;
  customer_telegram_id: string;
}

interface SendResult {
  broadcast_id: string;
  attempted: number;
  sent: number;
  rate_limited: number;
  telegram_errors: number;
  blocked_by_daily_cap: boolean;
}

type Tab = 'code' | 'customers' | 'earnings' | 'activity' | 'class';

export default function ResellerDashboard() {
  const [tab, setTab] = useState<Tab>('code');
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [resellerId, setResellerId] = useState<number | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [classComparison, setClassComparison] = useState<ClassComparisonData | null>(null);
  const [earningsFilter, setEarningsFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Message modal state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<number>>(new Set());
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [messageHistory, setMessageHistory] = useState<MessageHistoryRow[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      // Always load code + customers
      const customersRes = await adminFetch('/api/v1/admin/reseller-dashboard/customers');
      if (customersRes.status === 403) {
        setError('Akun kamu belum punya role reseller. Hubungi admin.');
        setLoading(false);
        return;
      }
      if (!customersRes.ok) {
        setError(`Gagal memuat data (${customersRes.status})`);
        setLoading(false);
        return;
      }
      const cData: CustomersData = await customersRes.json();
      setCodes(cData.codes);
      setCustomers(cData.customers);
      setResellerId(cData.reseller_id);

      // Earnings (load regardless of tab — it's small)
      const earningsRes = await adminFetch('/api/v1/admin/reseller-dashboard/earnings');
      if (earningsRes.ok) setEarnings(await earningsRes.json());

      // Activity
      const activityRes = await adminFetch('/api/v1/admin/reseller-dashboard/activity');
      if (activityRes.ok) setActivity(await activityRes.json());

      // Class comparison (only loads if reseller is also a teacher)
      const classRes = await adminFetch('/api/v1/admin/reseller-dashboard/class-comparison');
      if (classRes.ok) setClassComparison(await classRes.json());

      // Message history
      const msgRes = await adminFetch('/api/v1/admin/reseller-dashboard/message-history');
      if (msgRes.ok) {
        const d = await msgRes.json();
        setMessageHistory(d.messages || []);
      }
    } catch (e) {
      setError('Gagal memuat data. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  async function loadEarningsFiltered(filter: string) {
    setEarningsFilter(filter);
    const url = filter
      ? `/api/v1/admin/reseller-dashboard/earnings?status=${filter}`
      : '/api/v1/admin/reseller-dashboard/earnings';
    const res = await adminFetch(url);
    if (res.ok) setEarnings(await res.json());
  }

  async function sendBroadcast() {
    if (!messageText.trim() || selectedCustomerIds.size === 0) return;
    setSendingMessage(true);
    setSendResult(null);
    try {
      const res = await adminFetch('/api/v1/admin/reseller-dashboard/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          customer_ids: Array.from(selectedCustomerIds),
        }),
      });
      if (res.ok) {
        const result: SendResult = await res.json();
        setSendResult(result);
        setMessageText('');
        setSelectedCustomerIds(new Set());
        // Reload history
        const msgRes = await adminFetch('/api/v1/admin/reseller-dashboard/message-history');
        if (msgRes.ok) {
          const d = await msgRes.json();
          setMessageHistory(d.messages || []);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setSendResult({
          broadcast_id: '', attempted: 0, sent: 0, rate_limited: 0, telegram_errors: 0,
          blocked_by_daily_cap: true,
        });
        alert(err.error || 'Gagal kirim pesan.');
      }
    } catch (e) {
      alert('Gagal kirim pesan. Coba lagi.');
    } finally {
      setSendingMessage(false);
    }
  }

  function toggleCustomerSelection(id: number) {
    const next = new Set(selectedCustomerIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCustomerIds(next);
  }

  function selectAllCustomers() {
    setSelectedCustomerIds(new Set(customers.map((c) => c.customer_id)));
  }

  function clearSelection() {
    setSelectedCustomerIds(new Set());
  }

  function copyShareLink(code: string) {
    const link = `https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=reseller_${code}`;
    try {
      navigator.clipboard.writeText(link);
      alert('Link disalin! Bagikan ke customer.');
    } catch {
      prompt('Copy link ini:', link);
    }
  }

  // Filter earnings by status
  const filteredEarnings = earnings?.attributions.filter((a) =>
    !earningsFilter || a.status === earningsFilter
  ) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tg-button mx-auto mb-4"></div>
          <p className="text-tg-hint">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-lg mx-auto text-center mt-12">
        <div className="text-5xl mb-4">🚫</div>
        <p className="text-tg-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-1">💰 Reseller Dashboard</h1>
      <p className="text-tg-hint text-sm mb-4">Monitor kode, customer, dan komisi kamu</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-xs text-tg-hint">Customer</p>
          <p className="text-xl font-bold text-blue-700">
            {customers.length}
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xs text-tg-hint">Revenue</p>
          <p className="text-xl font-bold text-green-700">
            ⭐ {codes.reduce((s, c) => s + c.total_revenue_stars, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-xs text-tg-hint">Komisi</p>
          <p className="text-xl font-bold text-purple-700">
            ⭐ {codes.reduce((s, c) => s + c.total_commission_stars, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['code', 'customers', 'earnings', 'activity', 'class'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
              tab === t
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-secondary text-tg-text'
            }`}
          >
            {t === 'code' ? '🏷️ Kode' : t === 'customers' ? '👥 Customer' : t === 'earnings' ? '💰 Earnings' : t === 'activity' ? '📈 Activity' : '🎓 Class'}
          </button>
        ))}
      </div>

      {/* Tab: Code */}
      {tab === 'code' && (
        <div className="space-y-3">
          {codes.length === 0 ? (
            <p className="text-tg-hint text-sm text-center py-6">
              Belum ada kode. Hubungi admin untuk generate.
            </p>
          ) : (
            codes.map((c) => (
              <div key={c.id} className="bg-tg-secondary rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-mono font-bold text-lg">{c.code}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-tg-hint">
                  {c.total_uses} customer · ⭐ {c.total_revenue_stars.toLocaleString()} revenue
                </p>
                <button
                  onClick={() => copyShareLink(c.code)}
                  className="mt-3 w-full bg-tg-button text-tg-button-text py-2 rounded-lg text-sm font-medium"
                >
                  📋 Copy Share Link
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Customers */}
      {tab === 'customers' && (
        <div>
          {customers.length === 0 ? (
            <p className="text-tg-hint text-sm text-center py-6">
              Belum ada customer. Share kode kamu untuk mulai!
            </p>
          ) : (
            <>
              {/* Action bar */}
              <div className="flex items-center justify-between mb-3 bg-tg-secondary rounded-xl p-2">
                <div className="text-sm">
                  <span className="font-semibold">{selectedCustomerIds.size}</span> dipilih
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectedCustomerIds.size === customers.length ? clearSelection : selectAllCustomers}
                    className="text-xs px-2 py-1 bg-tg-bg rounded"
                  >
                    {selectedCustomerIds.size === customers.length ? 'Hapus semua' : 'Pilih semua'}
                  </button>
                  <button
                    onClick={() => setShowMessageModal(true)}
                    disabled={selectedCustomerIds.size === 0}
                    className="text-xs px-3 py-1 bg-purple-600 text-white rounded font-medium disabled:opacity-50"
                  >
                    ✉️ Kirim Pesan ({selectedCustomerIds.size})
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {customers.map((c) => (
                  <div key={c.attribution_id} className="bg-tg-secondary rounded-xl p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.has(c.customer_id)}
                        onChange={() => toggleCustomerSelection(c.customer_id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{c.customer_name}</p>
                            <p className="text-xs text-tg-hint">
                              {c.customer_target_test || 'No target'} · {c.plan_days}-day plan
                            </p>
                            <p className="text-xs text-tg-hint mt-1">
                              Last test: {c.last_test_date ? new Date(c.last_test_date).toLocaleDateString() : 'never'}
                              {' · '}
                              {c.total_attempts} attempts
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded-full inline-block ${
                              c.status === 'paid' ? 'bg-green-100 text-green-700' :
                              c.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              c.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {c.status}
                            </span>
                            <p className="text-xs text-tg-hint mt-1">
                              ⭐ {c.commission_amount_stars}
                            </p>
                            {c.customer_is_premium === 1 && (
                              <p className="text-xs text-green-600 mt-1">👑 Premium</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Earnings */}
      {tab === 'earnings' && (
        <div>
          {/* Status filter */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {['', 'pending', 'confirmed', 'paid', 'clawback'].map((s) => (
              <button
                key={s}
                onClick={() => loadEarningsFiltered(s)}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                  earningsFilter === s
                    ? 'bg-tg-button text-tg-button-text'
                    : 'bg-tg-secondary text-tg-text'
                }`}
              >
                {s === '' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Totals row */}
          {earnings && Object.keys(earnings.totals).length > 0 && (
            <div className="grid grid-cols-4 gap-1 mb-3 text-center">
              {Object.entries(earnings.totals).map(([status, info]) => (
                <div key={status} className="bg-tg-secondary rounded p-2">
                  <p className="text-xs text-tg-hint">{status}</p>
                  <p className="text-sm font-bold">{info.count}</p>
                  <p className="text-xs">⭐ {info.stars}</p>
                </div>
              ))}
            </div>
          )}

          {filteredEarnings.length === 0 ? (
            <p className="text-tg-hint text-sm text-center py-6">
              Belum ada earnings.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredEarnings.map((a) => (
                <div key={a.id} className="bg-tg-secondary rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{a.customer_name}</p>
                      <p className="text-xs text-tg-hint">
                        {a.code} · {a.plan_days}d · {new Date(a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">⭐ {a.commission_amount_stars}</p>
                      <p className="text-xs text-tg-hint">
                        {a.status} · {a.payout_method || 'unpaid'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Activity */}
      {tab === 'activity' && (
        <div>
          {!activity || activity.weeks.length === 0 ? (
            <p className="text-tg-hint text-sm text-center py-6">
              Belum ada activity. Mulai share kode kamu!
            </p>
          ) : (
            <div className="space-y-2">
              {activity.weeks.map((w) => (
                <div key={w.week} className="bg-tg-secondary rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Week {w.week}</p>
                      <p className="text-xs text-tg-hint">{w.new_customers} new customers</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">⭐ {w.revenue_stars} revenue</p>
                      <p className="text-sm font-bold text-purple-700">
                        ⭐ {w.commission_stars} commission
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Class — overlap between my class students and my code customers */}
      {tab === 'class' && (
        <div>
          {classComparison?.message && (
            <p className="text-tg-hint text-sm text-center py-6 bg-tg-secondary rounded-xl mb-3">
              {classComparison.message}
            </p>
          )}
          {classComparison && !classComparison.message && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-tg-hint">Total student (class)</p>
                  <p className="text-xl font-bold text-blue-700">{classComparison.summary.total_students}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-tg-hint">Total customer (code)</p>
                  <p className="text-xl font-bold text-purple-700">{classComparison.summary.used_my_code}</p>
                </div>
              </div>
              {/* Overlap highlight */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 text-center">
                <p className="text-xs text-tg-hint">Overlap (class + my code)</p>
                <p className="text-2xl font-bold text-green-700">{classComparison.summary.overlap}</p>
                <p className="text-xs text-tg-hint mt-1">
                  Customer kamu yang juga student di class kamu
                </p>
              </div>

              {/* Overlap list */}
              {classComparison.overlap.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-green-700 mb-2">🎯 Overlap ({classComparison.overlap.length})</h3>
                  {classComparison.overlap.map((s) => (
                    <div key={s.id} className="bg-tg-secondary rounded-xl p-2 mb-1 text-sm">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-tg-hint">
                        Class + kode kamu · {s.target_test || 'no target'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Class-only list */}
              {classComparison.class_only.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-tg-hint mb-2">
                    👥 Class only — belum pakai kode kamu ({classComparison.class_only.length})
                  </h3>
                  {classComparison.class_only.map((s) => (
                    <div key={s.id} className="bg-tg-secondary rounded-xl p-2 mb-1 text-sm">
                      <p className="font-medium">{s.name}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Code-only list */}
              {classComparison.code_only.length > 0 && (
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-tg-hint mb-2">
                    💰 Code only — belum masuk class ({classComparison.code_only.length})
                  </h3>
                  {classComparison.code_only.map((s) => (
                    <div key={s.id} className="bg-tg-secondary rounded-xl p-2 mb-1 text-sm">
                      <p className="font-medium">{s.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Back link */}
      <div className="mt-6 text-center">
        <a href="/admin/teacher" className="text-tg-button text-sm">
          ← Teacher Dashboard (juga ada)
        </a>
      </div>

      {/* Message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-tg-bg rounded-t-3xl p-6 max-w-lg mx-auto">
            <h3 className="text-lg font-bold mb-2">✉️ Kirim Pesan ke {selectedCustomerIds.size} customer</h3>
            <p className="text-xs text-tg-hint mb-3">
              Maks 3 pesan/hari. Setiap customer cuma menerima 1 pesan dari kamu
              per 7 hari.
            </p>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value.slice(0, 1000))}
              placeholder="Tulis pesan kamu di sini..."
              className="w-full border border-tg-hint/30 rounded-xl p-3 text-sm min-h-[120px] mb-2"
            />
            <p className="text-xs text-tg-hint mb-4 text-right">
              {messageText.length}/1000
            </p>

            {sendResult && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${
                sendResult.sent > 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
              }`}>
                {sendResult.blocked_by_daily_cap ? (
                  <p>⚠️ Kamu sudah kirim 3 pesan hari ini. Coba lagi besok.</p>
                ) : (
                  <>
                    <p>✅ Terkirim: {sendResult.sent}</p>
                    {sendResult.rate_limited > 0 && (
                      <p>⏸️ Skip (cooldown 7 hari): {sendResult.rate_limited}</p>
                    )}
                    {sendResult.telegram_errors > 0 && (
                      <p>❌ Gagal kirim: {sendResult.telegram_errors}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {messageHistory.length > 0 && (
              <details className="mb-4">
                <summary className="text-xs text-tg-hint cursor-pointer">
                  History ({messageHistory.length} pesan terakhir)
                </summary>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {messageHistory.slice(0, 10).map((m, i) => (
                    <div key={i} className="text-xs bg-tg-secondary rounded p-2">
                      <p className="text-tg-hint">
                        {new Date(m.sent_at).toLocaleString()} → {m.customer_name}
                      </p>
                      <p className="truncate">{m.message_text}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setSendResult(null);
                }}
                className="flex-1 bg-tg-secondary text-tg-text py-2 rounded-xl text-sm font-medium"
              >
                Tutup
              </button>
              <button
                onClick={sendBroadcast}
                disabled={!messageText.trim() || selectedCustomerIds.size === 0 || sendingMessage}
                className="flex-1 bg-purple-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {sendingMessage ? 'Mengirim...' : `Kirim (${selectedCustomerIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
