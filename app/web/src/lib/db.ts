// Per-user persistence on Supabase (RLS: a user only ever sees their own rows).
// We store the raw `input` (form / statement / persona ref) so a saved applicant
// can be re-scored deterministically by the engine — no need to cache transactions.

import { supabase } from './supabase'
import type { ScoreResult } from './api'

export type InputKind = 'form' | 'statement' | 'persona'

export interface SavedScore {
  id: string
  tabaqa_score: number | null
  pd: number | null
  risk_flag: string | null
  verified_income: number | null
  bank_only_income: number | null
  income: any
  reason_codes: any
  created_at: string
}

export interface SavedApplicant {
  id: string
  name: string
  connection_id: string | null
  input_kind: InputKind
  input: any
  created_at: string
  score: SavedScore | null
}

/** A friendly flag so the UI can tell "tables not migrated yet" from real errors. */
export class PersistenceUnavailable extends Error {}

function wrap(error: { message: string; code?: string } | null) {
  if (!error) return
  // 42P01 = undefined_table → the applicants/scores migration hasn't been applied.
  if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
    throw new PersistenceUnavailable(error.message)
  }
  throw new Error(error.message)
}

export async function listApplicants(): Promise<SavedApplicant[]> {
  const { data, error } = await supabase
    .from('applicants')
    .select(
      'id,name,connection_id,input_kind,input,created_at,' +
        'scores(id,tabaqa_score,pd,risk_flag,verified_income,bank_only_income,income,reason_codes,created_at)',
    )
    .order('created_at', { ascending: false })
  wrap(error as any)
  return (data ?? []).map((a: any) => {
    const scores = (a.scores ?? []) as SavedScore[]
    const latest = scores.slice().sort((x, y) => (y.created_at > x.created_at ? 1 : -1))[0] ?? null
    const { scores: _drop, ...rest } = a
    return { ...rest, score: latest } as SavedApplicant
  })
}

export async function saveScoredApplicant(args: {
  name: string
  connection_id?: string | null
  input_kind: InputKind
  input: any
  result: ScoreResult
}): Promise<SavedApplicant> {
  const { data: appRow, error: e1 } = await supabase
    .from('applicants')
    .insert({
      name: args.name,
      connection_id: args.connection_id ?? null,
      input_kind: args.input_kind,
      input: args.input,
    })
    .select()
    .single()
  wrap(e1 as any)

  const { data: scoreRow, error: e2 } = await supabase
    .from('scores')
    .insert({
      applicant_id: appRow!.id,
      tabaqa_score: args.result.tabaqa_score,
      pd: args.result.pd,
      risk_flag: args.result.risk_flag,
      verified_income: args.result.income.true_monthly_income,
      bank_only_income: args.result.income.bank_only_income,
      income: args.result.income,
      reason_codes: args.result.reason_codes,
    })
    .select()
    .single()
  wrap(e2 as any)

  return { ...(appRow as any), score: scoreRow as SavedScore }
}

export async function deleteApplicant(id: string): Promise<void> {
  const { error } = await supabase.from('applicants').delete().eq('id', id)
  wrap(error as any)
}
