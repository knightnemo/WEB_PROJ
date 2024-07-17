package APIs.ClassroomAPI

import Common.API.API
import Global.ServiceCenter.classroomServiceCode
import io.circe.Decoder

abstract class ClassroomMessage[ReturnType: Decoder] extends API[ReturnType](classroomServiceCode)