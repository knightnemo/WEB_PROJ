package Common.DBAPI

import Common.API.API
import Common.Object.SqlParameter
import Global.ServiceCenter.dbManagerServiceCode

case class WriteDBMessage(sqlStatement: String, parameters: List[SqlParameter]) extends API[String](dbManagerServiceCode)