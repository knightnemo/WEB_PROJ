package Common.DBAPI

import Common.API.API
import Common.Object.SqlParameter
import Global.ServiceCenter.dbManagerServiceCode
import io.circe.Json


// Assuming Row and TraceID are defined elsewhere
case class ReadDBRowsMessage(sqlQuery: String, parameters: List[SqlParameter]) extends API[List[Json]](dbManagerServiceCode)