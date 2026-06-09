import React from 'react';
import { SvgIcon } from './SvgIcon';

import gearSvg from '@assets/icons/mobile/gear.svg?raw';
import chestSvg from '@assets/icons/mobile/chest.svg?raw';
import dotsSvg from '@assets/icons/mobile/dots.svg?raw';
import saveSvg from '@assets/icons/mobile/save.svg?raw';
import quitSvg from '@assets/icons/mobile/quit.svg?raw';
import hamburgerSvg from '@assets/icons/mobile/hamburger.svg?raw';
import hollowDiamondSvg from '@assets/icons/mobile/hollow-diamond.svg?raw';
import solidDiamondSvg from '@assets/icons/mobile/solid-diamond.svg?raw';

export const PixelGearIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={gearSvg} width="24" height="24" {...props} />
);

export const PixelChestIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={chestSvg} width="24" height="24" {...props} />
);

export const PixelDotsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={dotsSvg} width="24" height="24" {...props} />
);

export const PixelSaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={saveSvg} width="24" height="24" {...props} />
);

export const PixelQuitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={quitSvg} width="24" height="24" {...props} />
);

export const PixelHamburgerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={hamburgerSvg} width="24" height="24" {...props} />
);

export const PixelHollowDiamondIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={hollowDiamondSvg} width="32" height="32" {...props} />
);

export const PixelSolidDiamondIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SvgIcon raw={solidDiamondSvg} width="32" height="32" {...props} />
);
