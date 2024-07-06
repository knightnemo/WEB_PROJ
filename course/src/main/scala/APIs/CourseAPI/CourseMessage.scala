package APIs.CourseAPI

import Common.API.API
import Global.ServiceCenter.doctorServiceCode
import io.circe.Decoder

abstract class CourseMessage[ReturnType:Decoder] extends API[ReturnType](doctorServiceCode)
