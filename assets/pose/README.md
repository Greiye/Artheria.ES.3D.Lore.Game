# Pose model (B26 camera push-up counter)

`pose_landmarker_lite.task` is Google's MediaPipe Pose Landmarker (Lite, float16), Apache-2.0,
from `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`
(sha256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`, downloaded 2026-11-02).

The build copies it to `dist/pose/`, next to the library and WebAssembly from the pinned `@mediapipe/tasks-vision`
package. The game only downloads these when a player turns on "Count with camera" in the dojo's push-up drill.
Everything runs on the device; no frames are stored or sent.
