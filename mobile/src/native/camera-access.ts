type CameraPermission = { granted: boolean; status: string };

/** Unknown or refreshing access must never be presented as a denial. */
export function cameraAccessState(permission: CameraPermission | null, checking: boolean): 'checking' | 'granted' | 'needs-permission' {
  if (checking || !permission) return 'checking';
  return permission.granted ? 'granted' : 'needs-permission';
}
