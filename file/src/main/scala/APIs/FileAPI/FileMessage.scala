package APIs.FileAPI

import Common.API.API
import Global.ServiceCenter.fileServiceCode
import io.circe.Decoder

abstract class FileMessage[ReturnType: Decoder] extends API[ReturnType](fileServiceCode)