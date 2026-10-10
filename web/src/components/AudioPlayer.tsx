import React, { useState, useEffect, useRef } from 'react';
import { SpeakerHigh, Play, Pause, ArrowClockwise } from '@phosphor-icons/react';
import { Language } from '../types';

interface AudioPlayerProps {
  text: string;
  language: Language;
  title?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, language, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasSupport, setHasSupport] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setHasSupport(false);
      return;
    }

    // Stop ongoing speech on unmount or text change
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleTogglePlay = () => {
    if (!hasSupport) return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 0.95; // Slightly slower, calm clinical tone
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleRestart = () => {
    if (!hasSupport) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setTimeout(() => {
      handleTogglePlay();
    }, 100);
  };

  return (
    <div className="bg-gradient-to-r from-brand-50/90 to-teal-50/50 border border-brand-200/80 rounded-2xl p-4 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-subtle">
          <SpeakerHigh size={20} weight={isPlaying ? 'fill' : 'bold'} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800">
              {title || (language === 'en' ? 'ElevenLabs Audio Advocate' : 'Audio Guía ElevenLabs')}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white/80 text-brand-700 border border-brand-200">
              {language === 'en' ? 'Natural Speech' : 'Voz Natural'}
            </span>
          </div>
          <p className="text-xs text-ink-secondary mt-0.5 line-clamp-1 max-w-xl">
            {text}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {/* Waveform indicator bars when playing */}
        {isPlaying && (
          <div className="flex items-center gap-1 mr-3 h-5">
            <span className="w-1 bg-brand-600 rounded-full animate-pulse h-3"></span>
            <span className="w-1 bg-brand-500 rounded-full animate-pulse h-5 delay-75"></span>
            <span className="w-1 bg-brand-400 rounded-full animate-pulse h-2 delay-150"></span>
            <span className="w-1 bg-brand-600 rounded-full animate-pulse h-4 delay-100"></span>
          </div>
        )}

        <button
          onClick={handleRestart}
          title={language === 'en' ? 'Restart' : 'Reiniciar'}
          className="p-2 rounded-lg text-ink-secondary hover:text-brand-700 hover:bg-white/80 border border-transparent hover:border-slate-200 transition-colors"
        >
          <ArrowClockwise size={16} />
        </button>

        <button
          onClick={handleTogglePlay}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-subtle hover:shadow-card transition-all"
        >
          {isPlaying ? (
            <>
              <Pause size={14} weight="bold" />
              <span>{language === 'en' ? 'Pause' : 'Pausar'}</span>
            </>
          ) : (
            <>
              <Play size={14} weight="bold" />
              <span>{language === 'en' ? 'Listen Aloud' : 'Escuchar Resumen'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
