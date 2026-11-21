export interface GuideStep {
  title: string;
  body: string;
  /** A concrete thing to try, written as an instruction. */
  tryIt: string;
}

/** The first-workflow guide. Every instruction refers to something the Studio actually has. */
export const GUIDE_STEPS: GuideStep[] = [
  {
    title: 'What is a workflow?',
    body: 'A workflow is a chain of blocks. Data starts at a Virtual Sensor, which generates mock readings, and flows along the connections through the other blocks.',
    tryIt: 'Look at the canvas: each box is a block and each line is a connection. Use Examples to load a ready-made workflow.',
  },
  {
    title: 'Add a block',
    body: 'Blocks live in the palette on the left, grouped by category. A new block is selected right away so you can configure it.',
    tryIt: 'Drag a block from the palette onto the canvas, or click it to add it in the middle. Select a block and press Delete to remove it.',
  },
  {
    title: 'Connect blocks',
    body: 'Data only travels along connections. A sensor has an output only, and a Kubernetes block has an input only.',
    tryIt: 'Drag from the small handle on the right side of one block to the handle on the left side of another.',
  },
  {
    title: 'Configure a sensor',
    body: 'A Virtual Sensor produces mock values between its Minimum and Maximum, following the Data pattern you choose: sine, random or ramp.',
    tryIt: 'Select the sensor, then in the Inspector on the right set the Unit, Minimum, Maximum and Data pattern.',
  },
  {
    title: 'Configure a logic rule',
    body: 'A Logic block compares each incoming value with a threshold and passes it on only when the comparison is true.',
    tryIt: 'Select the Logic block and choose an Operator and Threshold. For a sensor from 15 to 40, ">" with 30 passes only the warm readings.',
  },
  {
    title: 'Run the simulation',
    body: 'The simulation runs inside your browser once a second. Nothing is sent anywhere: MQTT and Cloud API blocks only log what they would send.',
    tryIt: 'Click Run simulation. Watch Live Data on the right and the Event Log at the bottom, then click Stop.',
  },
  {
    title: 'Export your workflow',
    body: 'Export JSON saves the workflow as a file you can import later. Generate project creates a starter project with a simulator and a README.',
    tryIt: 'Click Export JSON, then Download JSON. Try Generate project and read the README.md in the preview.',
  },
];
