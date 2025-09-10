declare module '@biowasm/aioli' {
  export default class Aioli {
    constructor(tools: string[]);
    init(): Promise<any>;
    exec(command: string): Promise<string>;
    mount(file: File): Promise<void>;
  }
}
