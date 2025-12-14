const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const AIRTABLE_TABLE_NAME = import.meta.env.VITE_AIRTABLE_TABLE_NAME

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`

export const airtableQueries = {
  // Get all records
  getAll: async () => {
    try {
      const response = await fetch(AIRTABLE_API_URL, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.records
    } catch (error) {
      console.error('Error fetching from Airtable:', error)
      throw error
    }
  },

  // Get record by ID
  getById: async (recordId) => {
    try {
      const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching record from Airtable:', error)
      throw error
    }
  },

  // Create record
  create: async (fields) => {
    try {
      const response = await fetch(AIRTABLE_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      })
      
      if (!response.ok) {
        throw new Error(`Airtable API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error creating record in Airtable:', error)
      throw error
    }
  }
}
