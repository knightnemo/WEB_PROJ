package APIs.LiveStreamAPI

import Common.API.API
import Global.ServiceCenter.liveStreamServiceCode
import io.circe.Decoder

abstract class LiveStreamMessage[ReturnType: Decoder] extends API[ReturnType](liveStreamServiceCode)