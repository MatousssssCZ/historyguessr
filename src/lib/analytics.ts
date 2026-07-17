// Typované analytické události.
//
// Napojeno na stávající track() (tabulka analytics_events). Smysl tohohle
// modulu je, aby názvy událostí a jejich payloady žily na JEDNOM místě —
// ne roztroušené jako magické stringy po komponentách.
import { track } from './supabase'

// ─── Kampaně ──────────────────────────────────────────────
export type CampaignEventName =
  | 'campaigns_viewed'
  | 'campaign_category_opened'
  | 'campaign_opened'
  | 'campaign_locked_attempt'   // klik na zamčený obsah
  | 'campaign_started'
  | 'campaign_completed'
  | 'campaign_abandoned'
  | 'campaign_personal_best'
  | 'campaign_star_earned'
  | 'campaign_unlocked'
  | 'campaign_category_unlocked'

// ─── Monetizace ───────────────────────────────────────────
export type MonetizationEventName =
  | 'upsell_shown'
  | 'upsell_cta_clicked'
  | 'premium_feature_attempt'
  | 'expeditions_exhausted'

/** Proč se upsell ukázal — bez toho je metrika k ničemu. */
export type UpsellReason =
  | 'no_expeditions'
  | 'premium_category'
  | 'premium_campaign'
  | 'premium_single_player_feature'

// ─── Single Player ────────────────────────────────────────
export type SinglePlayerEventName =
  | 'sp_filter_used'
  | 'sp_premium_filter_attempt'
  | 'sp_preset_created'
  | 'sp_preset_started'
  | 'sp_preset_shared'
  | 'sp_preset_invalid'

type AnyEventName = CampaignEventName | MonetizationEventName | SinglePlayerEventName
type Props = Record<string, unknown>

function emit(name: AnyEventName, props: Props = {}, userId?: string) {
  track(name, props, userId)
}

// ─── Veřejné API ──────────────────────────────────────────

export const campaignAnalytics = {
  viewed: (userId?: string) => emit('campaigns_viewed', {}, userId),

  categoryOpened: (categoryId: string, userId?: string) =>
    emit('campaign_category_opened', { category_id: categoryId }, userId),

  opened: (campaignId: string, userId?: string) =>
    emit('campaign_opened', { campaign_id: campaignId }, userId),

  /** Klik na zamčený obsah — `reason` říká, co ho blokuje. */
  lockedAttempt: (
    kind: 'category' | 'campaign',
    id: string,
    reason: 'stars' | 'premium',
    missingStars: number,
    userId?: string,
  ) => emit('campaign_locked_attempt', { kind, id, reason, missing_stars: missingStars }, userId),

  started: (campaignId: string, userId?: string) =>
    emit('campaign_started', { campaign_id: campaignId }, userId),

  completed: (
    campaignId: string, totalScore: number, stars: number, isBest: boolean, userId?: string,
  ) => {
    emit('campaign_completed', { campaign_id: campaignId, total_score: totalScore, stars, is_best: isBest }, userId)
    if (isBest) emit('campaign_personal_best', { campaign_id: campaignId, total_score: totalScore }, userId)
    if (stars > 0) emit('campaign_star_earned', { campaign_id: campaignId, stars }, userId)
  },

  abandoned: (campaignId: string, atRound: number, userId?: string) =>
    emit('campaign_abandoned', { campaign_id: campaignId, at_round: atRound }, userId),

  campaignUnlocked: (campaignId: string, userId?: string) =>
    emit('campaign_unlocked', { campaign_id: campaignId }, userId),

  categoryUnlocked: (categoryId: string, userId?: string) =>
    emit('campaign_category_unlocked', { category_id: categoryId }, userId),
}

export const monetizationAnalytics = {
  upsellShown: (reason: UpsellReason, userId?: string) =>
    emit('upsell_shown', { reason }, userId),

  upsellCtaClicked: (reason: UpsellReason, userId?: string) =>
    emit('upsell_cta_clicked', { reason }, userId),

  premiumFeatureAttempt: (feature: string, userId?: string) =>
    emit('premium_feature_attempt', { feature }, userId),

  expeditionsExhausted: (userId?: string) =>
    emit('expeditions_exhausted', {}, userId),
}

export const singlePlayerAnalytics = {
  filterUsed: (filter: string, value?: unknown, userId?: string) =>
    emit('sp_filter_used', { filter, value }, userId),

  premiumFilterAttempt: (filter: string, userId?: string) =>
    emit('sp_premium_filter_attempt', { filter }, userId),

  presetCreated: (presetId: string, userId?: string) =>
    emit('sp_preset_created', { preset_id: presetId }, userId),

  presetStarted: (presetId: string, userId?: string) =>
    emit('sp_preset_started', { preset_id: presetId }, userId),

  presetShared: (presetId: string, userId?: string) =>
    emit('sp_preset_shared', { preset_id: presetId }, userId),

  presetInvalid: (presetId: string, available: number, needed: number, userId?: string) =>
    emit('sp_preset_invalid', { preset_id: presetId, available, needed }, userId),
}
