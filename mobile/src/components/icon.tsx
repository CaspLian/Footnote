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
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
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
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { useFootnoteStore } from '@/store';
import { useTheme } from '@/theme';

const icons = {
  edit: PencilSimpleIcon,
  bookmark: BookmarkSimpleIcon,
  family: UsersThreeIcon, profile: UserCircleIcon, lock: LockKeyIcon, house: HouseIcon, files: FilesIcon, book: BookOpenIcon, document: FileTextIcon,
  camera: CameraIcon, images: ImagesIcon, pdf: FilePdfIcon, back: CaretLeftIcon,
  next: CaretRightIcon, globe: GlobeIcon, settings: GearSixIcon, speaker: SpeakerHighIcon,
  play: PlayIcon, trash: TrashIcon, stop: StopIcon, copy: CopyIcon, export: ExportIcon, check: CheckCircleIcon,
  calendar: CalendarBlankIcon, plus: PlusIcon, close: XIcon, search: MagnifyingGlassIcon,
} satisfies Record<string, ComponentType<IconProps>>;
export type IconName = keyof typeof icons;
export function Icon({ name, size, color, selected, feature, ...props }: IconProps & { name: IconName; selected?: boolean; feature?: boolean }) {
  const { colors } = useTheme();
  const iconSize = useFootnoteStore(s => s.iconSize);
  const weight = useFootnoteStore(s => s.iconWeight);
  const opacity = useFootnoteStore(s => s.duotoneOpacity);
  const Component = icons[name];
  return <View accessible={false} importantForAccessibility="no-hide-descendants"><Component size={size ?? iconSize} color={color ?? colors.ink} weight={selected ? 'fill' : feature ? 'duotone' : weight} duotoneColor={color ?? colors.ink} duotoneOpacity={opacity} {...props} /></View>;
}
