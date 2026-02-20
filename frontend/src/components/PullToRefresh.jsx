import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { PullToRefreshContext } from '../context/PullToRefreshContext';
import './PullToRefresh.css';

const PULL_THRESHOLD = 60;
const PULL_MAX = 90;

export default function PullToRefresh() {
  const ctx = useContext(PullToRefreshContext);
  const scrollContainer = ctx?.scrollContainer ?? null;
  const refreshCallback = ctx?.refreshCallback ?? null;
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshCallbackRef = useRef(refreshCallback);
  const refreshingRef = useRef(refreshing);

  refreshCallbackRef.current = refreshCallback;
  refreshingRef.current = refreshing;
  pullDistanceRef.current = pullDistance;

  const runRefresh = useCallback(async () => {
    if (!refreshCallbackRef.current || refreshingRef.current) return;
    setRefreshing(true);
    setPullDistance(0);
    try {
      const result = refreshCallbackRef.current();
      if (result && typeof result.then === 'function') {
        await result;
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !refreshCallback) return;

    const target = scrollContainer || document;
    const getScrollTop = () =>
      scrollContainer ? scrollContainer.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop);

    const handleStart = (e) => {
      if (getScrollTop() <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      } else {
        pulling.current = false;
      }
    };

    const handleMove = (e) => {
      if (!pulling.current) return;
      if (getScrollTop() > 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      const y = e.touches[0].clientY;
      const delta = Math.max(0, y - startY.current);
      const distance = Math.min(delta * 0.5, PULL_MAX);
      setPullDistance(distance);
      pullDistanceRef.current = distance;
      if (distance > 10) {
        e.preventDefault();
      }
    };

    const handleEnd = () => {
      const dist = pullDistanceRef.current;
      if (dist >= PULL_THRESHOLD && refreshCallbackRef.current && !refreshingRef.current) {
        runRefresh();
      } else {
        setPullDistance(0);
      }
      pulling.current = false;
    };

    target.addEventListener('touchstart', handleStart, { passive: true });
    target.addEventListener('touchmove', handleMove, { passive: false });
    target.addEventListener('touchend', handleEnd, { passive: true });
    target.addEventListener('touchcancel', handleEnd, { passive: true });

    return () => {
      target.removeEventListener('touchstart', handleStart);
      target.removeEventListener('touchmove', handleMove);
      target.removeEventListener('touchend', handleEnd);
      target.removeEventListener('touchcancel', handleEnd);
    };
  }, [scrollContainer, refreshCallback, runRefresh]);

  useEffect(() => {
    if (!refreshing) setPullDistance(0);
  }, [refreshing]);

  if (!Capacitor.isNativePlatform()) return null;

  const showIndicator = pullDistance > 0 || refreshing;
  const progress = Math.min(pullDistance / PULL_MAX, 1);

  const indicator = (
    <div
      className="pull-to-refresh-indicator"
      style={{
        opacity: showIndicator ? 1 : 0,
        transform: `translateY(${showIndicator ? 0 : -100}%)`,
        transition: 'transform 0.25s ease, opacity 0.2s ease',
      }}
      aria-live="polite"
      aria-busy={refreshing}
    >
      <div className="pull-to-refresh-indicator-inner">
        {refreshing ? (
          <span className="pull-to-refresh-spinner" aria-hidden />
        ) : (
          <span className="pull-to-refresh-arrow" style={{ transform: `rotate(${progress * 180}deg)` }} aria-hidden>↓</span>
        )}
        <span className="pull-to-refresh-label">
          {refreshing ? 'Actualizando…' : pullDistance >= PULL_THRESHOLD ? 'Soltá para actualizar' : 'Deslizá para actualizar'}
        </span>
      </div>
    </div>
  );

  return createPortal(indicator, document.body);
}
