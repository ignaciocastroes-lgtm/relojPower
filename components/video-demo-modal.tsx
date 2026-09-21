"use client"

import { X, Volume2, VolumeX, Play } from "lucide-react"
import { useState, useEffect } from "react"

interface VideoDemoModalProps {
  isOpen: boolean
  onClose: () => void
  exerciseName: string
  videoId: string
}

export function VideoDemoModal({ isOpen, onClose, exerciseName, videoId }: VideoDemoModalProps) {
  const [isMuted, setIsMuted] = useState(true)
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-2xl z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{exerciseName}</h3>
              <p className="text-sm text-muted-foreground">Demostración de técnica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-secondary/80 flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Video Container */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl shadow-primary/20">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&mute=${isMuted ? 1 : 0}&controls=0&modestbranding=1&rel=0&showinfo=0`}
            title={`${exerciseName} - Demo`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
          
          {/* Video Overlay Controls */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
          
          {/* Neon Border Glow */}
          <div className="absolute inset-0 rounded-2xl border border-primary/30 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}
