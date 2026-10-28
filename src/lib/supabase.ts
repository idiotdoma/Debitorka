import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Создаём клиент только если переменные окружения настроены
// В противном случае приложение работает в демо-режиме с localStorage
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// Флаг для проверки, настроен ли Supabase
export const isSupabaseConfigured = supabase !== null;

// Types for database models
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  position?: string;
  timezone: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  stale_data_threshold_hours: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'finance' | 'employee' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  manager_id?: string;
  parent_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Counterparty {
  id: string;
  organization_id: string;
  external_id?: string;
  name: string;
  normalized_name: string;
  inn?: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DebtRecord {
  id: string;
  organization_id: string;
  import_batch_id?: string;
  counterparty_id?: string;
  external_id?: string;
  document_key: string;
  counterparty_name: string;
  counterparty_inn?: string;
  doc_number: string;
  doc_date?: string;
  due_date?: string;
  amount_cents: number;
  currency: string;
  owner_email?: string;
  notes?: string;
  source_type: 'manual_import' | 'onec_odata' | 'custom_http';
  source_updated_at?: string;
  last_source_update: string;
  created_at: string;
  updated_at: string;
}

export interface DebtRecordCurrent extends DebtRecord {
  current_overdue_days: number | null;
  current_category: 'no_due_date' | 'not_overdue' | 'days_1_7' | 'days_8_30' | 'days_31_60' | 'days_60_plus';
}

export interface Task {
  id: string;
  organization_id: string;
  team_id?: string;
  title: string;
  description?: string;
  type: 'call_counterparty' | 'send_payment_reminder' | 'check_payment_status' | 'verify_promise' | 'prepare_claim_docs' | 'internal_review' | 'other';
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'new' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';
  counterparty_id?: string;
  counterparty_name?: string;
  debt_record_id?: string;
  assigned_to: string;
  created_by: string;
  due_date: string;
  completed_at?: string;
  result?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  organization_id: string;
  counterparty_id?: string;
  counterparty_name: string;
  debt_record_id?: string;
  type: 'outgoing_call' | 'incoming_call' | 'outgoing_email' | 'incoming_email' | 'messenger' | 'meeting' | 'other';
  direction: 'incoming' | 'outgoing' | 'neutral';
  contact_date: string;
  employee_id: string;
  summary: string;
  result?: 'confirmed_payment' | 'promised_payment' | 'documents_requested' | 'failed_to_contact' | 'disputes_debt' | 'payment_not_approved' | 'needs_follow_up' | 'other';
  result_comment?: string;
  next_contact_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentPromise {
  id: string;
  organization_id: string;
  counterparty_id?: string;
  counterparty_name: string;
  debt_record_id?: string;
  promised_date: string;
  promised_amount_cents: number;
  currency: string;
  status: 'expected' | 'fulfilled' | 'partially_fulfilled' | 'broken' | 'cancelled';
  source: 'call' | 'email' | 'messenger' | 'meeting' | 'other';
  contact_name: string;
  employee_id: string;
  comment?: string;
  actual_received_cents?: number;
  actual_receipt_verified: boolean;
  last_check_date?: string;
  transfer_history: any[];
  cancellation_reason?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  organization_id: string;
  recipient_id: string;
  type: 'task_due_soon' | 'task_overdue' | 'promise_due' | 'promise_broken' | 'task_no_action' | 'critical_task_escalation' | 'new_task_assigned' | 'promise_needs_check';
  title: string;
  message: string;
  related_task_id?: string;
  related_promise_id?: string;
  related_debt_id?: string;
  related_counterparty?: string;
  is_read: boolean;
  idempotency_key: string;
  created_at: string;
}

export interface ImportBatch {
  id: string;
  organization_id: string;
  file_name: string;
  file_hash?: string;
  source_type: 'manual_import' | 'onec_odata' | 'custom_http';
  row_count: number;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  updated_count: number;
  new_count: number;
  missing_from_source: number;
  status: 'preview' | 'completed' | 'completed_with_warnings' | 'failed' | 'partial';
  errors: any[];
  warnings: any[];
  imported_by?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'manager' | 'finance' | 'employee' | 'viewer';
  team_id?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  updated_at: string;
}

// API helper functions
export async function getCurrentUser() {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { ...user, profile };
}

export async function getUserOrganizations() {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data: memberships } = await supabase
    .from('organization_memberships')
    .select(`
      *,
      organization:organizations(*)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true);
  
  return memberships || [];
}

export async function createOrganization(name: string, timezone: string = 'Europe/Moscow') {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('create_organization_for_current_user', {
    p_name: name,
    p_timezone: timezone,
  });
  
  if (error) throw error;
  return data;
}

export async function getDebts(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('debt_records_current')
    .select('*')
    .eq('organization_id', organizationId)
    .order('due_date', { ascending: true });
  
  if (error) throw error;
  return data;
}

export async function getTasks(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', organizationId)
    .order('due_date', { ascending: true });
  
  if (error) throw error;
  return data;
}

export async function getCounterparties(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('counterparties')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');
  
  if (error) throw error;
  return data;
}

export async function getPaymentPromises(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('payment_promises')
    .select('*')
    .eq('organization_id', organizationId)
    .order('promised_date', { ascending: true });
  
  if (error) throw error;
  return data;
}

export async function getNotifications(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(notificationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  
  if (error) throw error;
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, updates: Partial<Task>) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createCommunication(communication: Omit<Communication, 'id' | 'created_at' | 'updated_at'>) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('communications')
    .insert(communication)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createPaymentPromise(promise: Omit<PaymentPromise, 'id' | 'created_at' | 'updated_at' | 'actual_receipt_verified' | 'transfer_history'>) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('payment_promises')
    .insert({
      ...promise,
      actual_receipt_verified: false,
      transfer_history: [],
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getDebtAnalytics(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('debt_analytics_by_currency')
    .select('*')
    .eq('organization_id', organizationId);
  
  if (error) throw error;
  return data;
}

export async function getDebtAging(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('debt_aging_by_currency')
    .select('*')
    .eq('organization_id', organizationId);
  
  if (error) throw error;
  return data;
}

export async function getDebtByCounterparty(organizationId: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('debt_analytics_by_counterparty')
    .select('*')
    .eq('organization_id', organizationId)
    .order('total_debt_sort_numeric', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function commitManualImport(
  organizationId: string,
  importBatchId: string,
  rows: any[],
  warnings: any[] = []
) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('commit_manual_import', {
    p_organization_id: organizationId,
    p_import_batch_id: importBatchId,
    p_rows: rows,
    p_warnings: warnings,
  });
  
  if (error) throw error;
  return data;
}

export async function createInvitation(
  organizationId: string,
  email: string,
  role: string,
  teamId?: string
) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('create_org_invitation', {
    p_organization_id: organizationId,
    p_email: email,
    p_role: role,
    p_team_id: teamId,
  });
  
  if (error) throw error;
  return data;
}

export async function acceptInvitation(token: string) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('accept_org_invitation', {
    p_token: token,
  });
  
  if (error) throw error;
  return data;
}
