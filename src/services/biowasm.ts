import Aioli from '@biowasm/aioli';

export class BiowasmService {
  private aioli: any; // Aioli instance after initialization
  private tools: string[];

  constructor(tools: string[]) {
    this.tools = tools;
  }

  async init() {
    try {
      console.log('Creating Aioli instance with tools:', this.tools);
      this.aioli = await new Aioli(this.tools);
      console.log('Aioli initialized successfully');
      return this.aioli;
    } catch (error) {
      console.error('Failed to initialize Aioli:', error);
      throw error;
    }
  }

  async exec(command: string, args: string[] = []) {
    if (!this.aioli) {
      throw new Error('Aioli not initialized. Call init() first.');
    }
    
    try {
      const fullCommand = `${command} ${args.join(' ')}`;
      console.log('Executing command:', fullCommand);
      const result = await this.aioli.exec(fullCommand);
      console.log('Command result:', result);
      return result;
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  }

  async mount(file: File) {
    if (!this.aioli) {
      throw new Error('Aioli not initialized. Call init() first.');
    }
    
    try {
      // Use Aioli's mount method to mount the file
      await this.aioli.mount(file);
      console.log('File mounted successfully:', file.name);
    } catch (error) {
      console.error('Failed to mount file:', error);
      throw error;
    }
  }
}
