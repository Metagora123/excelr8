import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function to fetch all records with pagination
const fetchAllRecords = async (queryBuilderFn, pageSize = 1000) => {
  const allRecords = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const to = from + pageSize - 1
    // Create a fresh query builder for each page
    const queryBuilder = queryBuilderFn()
    const { data, error } = await queryBuilder.range(from, to)
    
    if (error) throw error
    
    if (data && data.length > 0) {
      allRecords.push(...data)
      // If we got fewer records than requested, we've reached the end
      hasMore = data.length === pageSize
      from += pageSize
    } else {
      hasMore = false
    }
  }

  return allRecords
}

// Helper functions for common queries
export const leadQueries = {
  // Get all leads (with pagination)
  getAll: async () => {
    const queryBuilderFn = () => supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    
    return await fetchAllRecords(queryBuilderFn)
  },

  // Get leads with dossiers (with pagination)
  getWithDossiers: async () => {
    const queryBuilderFn = () => supabase
      .from('leads')
      .select('*')
      .eq('is_dossier', true)
      .not('dossier_url', 'is', null)
      .order('created_at', { ascending: false })
    
    return await fetchAllRecords(queryBuilderFn)
  },

  // Get lead by ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  },

  // Get leads by status (with pagination)
  getByStatus: async (status) => {
    const queryBuilderFn = () => supabase
      .from('leads')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
    
    return await fetchAllRecords(queryBuilderFn)
  },

  // Get leads by tier (with pagination)
  getByTier: async (tier) => {
    const queryBuilderFn = () => supabase
      .from('leads')
      .select('*')
      .eq('tier', tier)
      .order('score', { ascending: false })
    
    return await fetchAllRecords(queryBuilderFn)
  },

  // Get stats (with pagination to get all records)
  getStats: async () => {
    const queryBuilderFn = () => supabase
      .from('leads')
      .select('status, tier, is_dossier, score')
    
    const data = await fetchAllRecords(queryBuilderFn)
    
    return {
      total: data.length,
      withDossiers: data.filter(l => l.is_dossier).length,
      byStatus: data.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1
        return acc
      }, {}),
      byTier: data.reduce((acc, lead) => {
        if (lead.tier) {
          acc[lead.tier] = (acc[lead.tier] || 0) + 1
        }
        return acc
      }, {}),
      averageScore: data.length > 0 
        ? data.reduce((sum, lead) => sum + (lead.score || 0), 0) / data.length 
        : 0
    }
  }
}
