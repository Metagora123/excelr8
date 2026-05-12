import { createClient } from "@/lib/supabase"

export type NewsletterPrompt = {
  id: string
  name: string
  html_prompt: string | null
  image_prompt: string | null
  created_at?: string | null
  updated_at?: string | null
}

const TABLE = "newsletter_prompts"

export const newsletterPromptQueries = {
  async list(): Promise<NewsletterPrompt[]> {
    const sb = createClient()
    const { data, error } = await sb
      .from(TABLE)
      .select("id, name, html_prompt, image_prompt, created_at, updated_at")
      .order("created_at", { ascending: true })
    if (error) throw new Error(`newsletter_prompts list: ${error.message}`)
    return (data ?? []) as NewsletterPrompt[]
  },

  async create(input: {
    name: string
    htmlPrompt: string | null
    imagePrompt: string | null
  }): Promise<NewsletterPrompt> {
    const sb = createClient()
    const { data, error } = await sb
      .from(TABLE)
      .insert({
        name: input.name,
        html_prompt: input.htmlPrompt,
        image_prompt: input.imagePrompt,
      })
      .select("id, name, html_prompt, image_prompt, created_at, updated_at")
      .single()
    if (error) throw new Error(`newsletter_prompts create: ${error.message}`)
    return data as NewsletterPrompt
  },

  async update(
    id: string,
    input: {
      name?: string
      htmlPrompt?: string | null
      imagePrompt?: string | null
    }
  ): Promise<NewsletterPrompt> {
    const sb = createClient()
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.htmlPrompt !== undefined) patch.html_prompt = input.htmlPrompt
    if (input.imagePrompt !== undefined) patch.image_prompt = input.imagePrompt
    patch.updated_at = new Date().toISOString()
    const { data, error } = await sb
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select("id, name, html_prompt, image_prompt, created_at, updated_at")
      .single()
    if (error) throw new Error(`newsletter_prompts update: ${error.message}`)
    return data as NewsletterPrompt
  },

  async remove(id: string): Promise<void> {
    const sb = createClient()
    const { error } = await sb.from(TABLE).delete().eq("id", id)
    if (error) throw new Error(`newsletter_prompts delete: ${error.message}`)
  },
}
