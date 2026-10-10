// Emoji picker — split into its own chunk (the emoji dataset is large) and loaded on first open
import React from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

export default function EmojiPicker({ onSelect, theme }: {
  onSelect: (emoji: { native: string }) => void
  theme: 'light' | 'dark'
}) {
  return (
    <Picker
      data={data}
      onEmojiSelect={onSelect}
      theme={theme}
      previewPosition="none"
      skinTonePosition="search"
    />
  )
}
