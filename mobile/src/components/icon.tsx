import { ComponentType } from 'react';
import { View } from 'react-native';
import { IconProps } from 'phosphor-react-native';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { FilesIcon } from 'phosphor-react-native/src/icons/Files';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { ImagesIcon } from 'phosphor-react-native/src/icons/Images';
import { FilePdfIcon } from 'phosphor-react-native/src/icons/FilePdf';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { GlobeIcon } from 'phosphor-react-native/src/icons/Globe';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { StopIcon } from 'phosphor-react-native/src/icons/Stop';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { ExportIcon } from 'phosphor-react-native/src/icons/Export';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { LockKeyIcon } from 'phosphor-react-native/src/icons/LockKey';
import { useUnfoldStore } from '@/store';
import { colors } from '@/theme';

const icons: Record<string, ComponentType<IconProps>> = {
  family: UsersThreeIcon, profile: UserCircleIcon, lock: LockKeyIcon, house: HouseIcon, files: FilesIcon, book: BookOpenIcon, document: FileTextIcon,
  camera: CameraIcon, images: ImagesIcon, pdf: FilePdfIcon, back: CaretLeftIcon,
  next: CaretRightIcon, globe: GlobeIcon, settings: GearSixIcon, speaker: SpeakerHighIcon,
  stop: StopIcon, copy: CopyIcon, export: ExportIcon, check: CheckCircleIcon,
  calendar: CalendarBlankIcon, plus: PlusIcon, close: XIcon, search: MagnifyingGlassIcon,
};
export type IconName = keyof typeof icons;
export function Icon({ name, size, color = colors.ink, selected, feature, ...props }: IconProps & { name: IconName; selected?: boolean; feature?: boolean }) {
  const iconSize = useUnfoldStore(s => s.iconSize);
  const weight = useUnfoldStore(s => s.iconWeight);
  const opacity = useUnfoldStore(s => s.duotoneOpacity);
  const Component = icons[name];
  return <View accessible={false} importantForAccessibility="no-hide-descendants"><Component size={size ?? iconSize} color={color} weight={selected ? 'fill' : feature ? 'duotone' : weight} duotoneColor={color} duotoneOpacity={opacity} {...props} /></View>;
}
