export interface User {
    id: string
    email: string
    walletAddress?: string
  }
  
  export interface ArtStyle {
    id: string
    name: string
    description: string
    preview: string
    price: number
  }
  
  export interface StickerOrder {
    id: string
    userId: string
    imageUrl: string
    styleId: string
    status: 'pending' | 'processing' | 'completed' | 'shipped'
    paymentStatus: 'pending' | 'paid' | 'failed'
    transactionHash?: string
    createdAt: Date
    updatedAt: Date
  }
  
  export interface ImageUpload {
    file: File
    preview: string
    processed?: string
  }