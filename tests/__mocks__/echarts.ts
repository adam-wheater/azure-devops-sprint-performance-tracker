// Mock for echarts' ESM subpath entry points (echarts/core, /charts, etc).
// The real package ships ES modules that Jest will not parse, and a chart needs
// real layout to render anyway. Chart configuration is covered directly against
// buildTimeSeriesOption in chartOptions.test.ts, and TimeSeriesChart.test.tsx
// installs its own spies over this module to assert the wrapper's behaviour.

export interface MockChartInstance {
  setOption: jest.Mock;
  dispatchAction: jest.Mock;
  resize: jest.Mock;
  dispose: jest.Mock;
}

const instances: MockChartInstance[] = [];

export const use = jest.fn();

export const init = jest.fn((..._args: unknown[]): MockChartInstance => {
  const instance: MockChartInstance = {
    setOption: jest.fn(),
    dispatchAction: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  };
  instances.push(instance);
  return instance;
});

/** Test helper: every chart instance created so far, oldest first. */
export function __getInstances(): MockChartInstance[] {
  return instances;
}

/** Test helper: the most recently created chart instance. */
export function __lastInstance(): MockChartInstance {
  const instance = instances[instances.length - 1];
  if (!instance) throw new Error("No chart instance was created.");
  return instance;
}

export function __resetInstances(): void {
  instances.length = 0;
  init.mockClear();
  use.mockClear();
}

// Chart types, components, features and renderers are only ever passed to
// `use()`, so empty markers are enough.
export const BarChart = {};
export const LineChart = {};
export const GridComponent = {};
export const TooltipComponent = {};
export const LegendComponent = {};
export const DataZoomComponent = {};
export const AriaComponent = {};
export const LabelLayout = {};
export const SVGRenderer = {};
