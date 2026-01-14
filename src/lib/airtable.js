const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const AIRTABLE_TABLE_NAME = import.meta.env.VITE_AIRTABLE_TABLE_NAME

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`

export const airtableQueries = {
  // Get all records (with pagination support)
  getAll: async () => {
    try {
      const allRecords = []
      let offset = null
      
      do {
        // Build URL with pagination parameters
        let url = AIRTABLE_API_URL
        const params = new URLSearchParams()
        if (offset) {
          params.append('offset', offset)
        }
        // Request max page size (100 is Airtable's default and maximum)
        params.append('pageSize', '100')
        
        if (params.toString()) {
          url += '?' + params.toString()
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          throw new Error(`Airtable API error: ${response.statusText}`)
        }
        
        const data = await response.json()
        allRecords.push(...data.records)
        
        // Check if there are more records to fetch
        offset = data.offset || null
      } while (offset)
      
      return allRecords
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
