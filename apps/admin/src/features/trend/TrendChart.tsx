import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { FONT_SANS, tokens } from '@echallan/theme';
import type { ChallanTrendPoint } from '@echallan/contracts';
import { LineChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
  type AriaComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import { init, registerTheme, use, type ComposeOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { LineSeriesOption } from 'echarts/charts';
import { formatTrendAxisDay } from './trendData';

/**
 * The only ECharts entry point in the product (design §8.3).
 *
 * Imports are modular so the chart runtime does not leak into the admin entry
 * chunk, and no bare `echarts` import is allowed by the boundary gate. The HTML
 * legend in `TrendPanel` is the keyboard-accessible legend; ECharts supplies
 * the canvas, tooltip, decals and its own generated aria description.
 */

use([LineChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer]);

const THEME_NAME = 'eChallanTrend';

registerTheme(THEME_NAME, {
  backgroundColor: 'transparent',
  color: [tokens.tone.info.fg, tokens.tone.success.fg, tokens.tone.cancelled.fg],
  textStyle: { fontFamily: FONT_SANS, color: tokens.ink },
  axisPointer: { lineStyle: { color: tokens.fieldLine } },
});

type TrendChartOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TooltipComponentOption | AriaComponentOption
>;

export interface TrendChartProps {
  points: ChallanTrendPoint[];
  /** Accessible summary; also used by the chart's generated aria description. */
  summary: string;
}

function chartOption({ points, summary }: TrendChartProps): TrendChartOption {
  const labelInterval = points.length > 20 ? Math.ceil(points.length / 10) - 1 : 0;

  return {
    animation: false,
    aria: {
      enabled: true,
      decal: { show: true },
      label: { description: summary },
    },
    color: [tokens.tone.info.fg, tokens.tone.success.fg, tokens.tone.cancelled.fg],
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: tokens.surface,
      borderColor: tokens.line,
      textStyle: { color: tokens.ink, fontFamily: FONT_SANS },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((point) => point.bucketStart),
      axisLine: { lineStyle: { color: tokens.line } },
      axisTick: { show: false },
      axisLabel: {
        color: tokens.muted,
        fontFamily: FONT_SANS,
        hideOverlap: true,
        interval: labelInterval,
        formatter: (value: string) => formatTrendAxisDay(value),
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tokens.muted, fontFamily: FONT_SANS },
      splitLine: { lineStyle: { color: tokens.lineSoft } },
    },
    series: [
      {
        name: 'Issued',
        type: 'line',
        smooth: false,
        connectNulls: false,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 7,
        data: points.map((point) => point.issued),
        lineStyle: { width: 2.5, color: tokens.tone.info.fg },
        itemStyle: { color: tokens.tone.info.fg },
      },
      {
        name: 'Resolved',
        type: 'line',
        smooth: false,
        connectNulls: false,
        showSymbol: true,
        symbol: 'rect',
        symbolSize: 7,
        data: points.map((point) => point.resolved),
        lineStyle: { width: 2.5, color: tokens.tone.success.fg },
        itemStyle: { color: tokens.tone.success.fg },
      },
      {
        name: 'Cancelled',
        type: 'line',
        smooth: false,
        connectNulls: false,
        showSymbol: true,
        symbol: 'diamond',
        symbolSize: 8,
        data: points.map((point) => point.cancelled),
        lineStyle: {
          width: 2.5,
          type: 'dashed',
          color: tokens.tone.cancelled.fg,
        },
        itemStyle: { color: tokens.tone.cancelled.fg },
      },
    ],
  };
}

export default function TrendChart(props: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { points, summary } = props;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const chart = init(container, THEME_NAME, { renderer: 'canvas' });
    chart.setOption(chartOption({ points, summary }), { notMerge: true });

    const resize = (): void => chart.resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (observer === null) {
      window.addEventListener('resize', resize);
    } else {
      observer.observe(container);
    }

    return () => {
      if (observer === null) {
        window.removeEventListener('resize', resize);
      } else {
        observer.disconnect();
      }
      chart.dispose();
    };
  }, [points, summary]);

  return (
    <Box
      ref={containerRef}
      role="img"
      aria-label={summary}
      data-testid="trend-chart"
      sx={{ width: '100%', minHeight: 280, height: { xs: 280, md: 340 } }}
    />
  );
}
