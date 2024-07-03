package APIs.PatientAPI

import Common.API.API
import Global.ServiceCenter.patientServiceCode
import io.circe.Decoder

abstract class PatientMessage[ReturnType:Decoder] extends API[ReturnType](patientServiceCode)
