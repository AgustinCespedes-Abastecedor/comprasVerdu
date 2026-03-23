import { ArrowLeft } from 'lucide-react';

/**
 * Flecha “volver” unificada para headers (Lucide, trazo consistente).
 */
export default function BackNavIcon({ className }) {
  return <ArrowLeft className={className} aria-hidden size={12} strokeWidth={2} />;
}
