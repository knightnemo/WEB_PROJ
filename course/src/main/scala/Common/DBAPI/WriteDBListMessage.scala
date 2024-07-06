package Common.DBAPI

import Common.API.API
import Common.Object.ParameterList
import Global.ServiceCenter.dbManagerServiceCode

case class WriteDBListMessage(sqlStatement: String, parameters: List[ParameterList]) extends API[String](dbManagerServiceCode)