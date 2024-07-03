package Common.DBAPI

import Common.API.API
import Common.Object.SqlParameter
import Global.ServiceCenter.dbManagerServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto.*

case class ReadDBValueMessage(sqlQuery: String, parameters: List[SqlParameter]) extends API[String](dbManagerServiceCode)
