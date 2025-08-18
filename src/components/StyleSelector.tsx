'use client'

import React from 'react';

export type ArtStyle =
  | 'Studio Ghibli'
  | 'SpongeBob'
  | 'Fairly Odd Parents'
  | 'The Simpsons'
  | 'Family Guy'
  | 'Scooby Doo'
  | 'Oil Painting'
  | 'Cubism';

const styles: ArtStyle[] = [
  'Studio Ghibli',
  'SpongeBob',
  'Fairly Odd Parents',
  'The Simpsons',
  'Family Guy',
  'Scooby Doo',
  'Oil Painting',
  'Cubism',
];

const styleInfo = {
  'Studio Ghibli': {
    name: 'Studio Ghibli',
    preview: 'Totoro, Howl, Spirited Away style',
    emoji: '🌟'
  },
  'SpongeBob': {
    name: 'SpongeBob',
    preview: 'SpongeBob SquarePants cartoon style',
    emoji: '🧽'
  },
  'Fairly Odd Parents': {
    name: 'Fairly Odd Parents',
    preview: 'Timmy Turner cartoon style',
    emoji: '⭐'
  },
  'The Simpsons': {
    name: 'The Simpsons',
    preview: 'Homer Simpson yellow cartoon style',
    emoji: '🍩'
  },
  'Family Guy': {
    name: 'Family Guy',
    preview: 'Peter Griffin cartoon style',
    emoji: '👨'
  },
  'Scooby Doo': {
    name: 'Scooby Doo',
    preview: 'Classic Hanna-Barbera cartoon style',
    emoji: '🐕'
  },
  'Oil Painting': {
    name: 'Oil Painting',
    preview: 'Classical Renaissance painting style',
    emoji: '🎨'
  },
  'Cubism': {
    name: 'Cubism',
    preview: 'Picasso abstract geometric style',
    emoji: '🔷'
  }
};

interface StyleSelectorProps {
  selectedStyle: ArtStyle | null;
  onSelect: (style: ArtStyle) => void;
}

const StyleSelector: React.FC<StyleSelectorProps> = ({ selectedStyle, onSelect }) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-center">Choose Your Art Style</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {styles.map((style) => {
          const info = styleInfo[style];
          return (
            <button
              key={style}
              type="button"
              className={`p-4 rounded-lg border-2 font-semibold shadow-md transition-all transform hover:scale-105 ${
                selectedStyle === style
                  ? 'bg-secondary text-white border-secondary shadow-lg'
                  : 'bg-white text-gray-800 border-gray-300 hover:border-secondary/50 hover:bg-secondary/5'
              }`}
              onClick={() => onSelect(style)}
            >
              <div className="text-center">
                <div className="text-2xl mb-2">{info.emoji}</div>
                <div className="font-bold text-sm mb-1">{info.name}</div>
                <div className="text-xs text-gray-600 leading-tight">
                  {info.preview}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default StyleSelector;