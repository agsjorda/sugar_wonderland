import { Scene } from 'phaser';

export class Preloader extends Scene
{
  constructor ()
  {
    super('Preloader');
  }

  init ()
  {
    //  We loaded this image in our Boot Scene, so we can display it here
    this.add.image(512, 384, 'background');

    //  A simple progress bar. This is the outline of the bar.
    this.add.rectangle(512, 384, 468, 32).setStrokeStyle(1, 0xffffff);

    //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
    const bar = this.add.rectangle(512-230, 384, 4, 28, 0xffffff);

    //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
    this.load.on('progress', (progress: number) => {

      //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
      bar.width = 4 + (460 * progress);

    });
  }

  preload ()
  {
    const FONTS = 'assets/fonts/poppins/';
    this.load.font('poppins-black', FONTS + 'Poppins-Black.ttf');
    this.load.font('poppins-black-italic', FONTS + 'Poppins-BlackItalic.ttf');
    
    this.load.font('poppins-bold', FONTS + 'Poppins-Bold.ttf');
    this.load.font('poppins-extrabold', FONTS + 'Poppins-ExtraBold.ttf');
    this.load.font('poppins-extrabold-italic', FONTS + 'Poppins-ExtraBoldItalic.ttf');
    this.load.font('poppins-extralight', FONTS + 'Poppins-ExtraLight.ttf');
    this.load.font('poppins-extralight-italic', FONTS + 'Poppins-ExtraLightItalic.ttf');
    this.load.font('poppins-italic', FONTS + 'Poppins-Italic.ttf');
    this.load.font('poppins-light', FONTS + 'Poppins-Light.ttf');
    this.load.font('poppins-light-italic', FONTS + 'Poppins-LightItalic.ttf');
    this.load.font('poppins-medium', FONTS + 'Poppins-Medium.ttf');
    this.load.font('poppins-medium-italic', FONTS + 'Poppins-MediumItalic.ttf');
    this.load.font('poppins-regular', FONTS + 'Poppins-Regular.ttf');
    this.load.font('poppins-semibold', FONTS + 'Poppins-SemiBold.ttf');
    this.load.font('poppins-semibold-italic', FONTS + 'Poppins-SemiBoldItalic.ttf');
    this.load.font('poppins-thin', FONTS + 'Poppins-Thin.ttf');
    this.load.font('poppins-thin-italic', FONTS + 'Poppins-ThinItalic.ttf');
    this.load.font('poppins', FONTS + 'Poppins-Regular.ttf');
    this.load.font('poppins-semibold', FONTS + 'Poppins-SemiBold.ttf');
    this.load.font('poppins-thin', FONTS + 'Poppins-Thin.ttf');
  }

  create ()
  {
    this.scene.start('Game');
  }
}
