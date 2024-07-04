package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{startTransaction, writeDB}
import cats.effect.IO
import io.circe.generic.auto.*

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, *}
import Common.Object.{ParameterList, SqlParameter}
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.PatientQueryMessage
import cats.effect.IO
import io.circe.generic.auto.*


case class DeletePatientMessagePlanner(doctorName: String, patientName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    /** step 1: 删除数据库中的记录 */
    startTransaction {
      for {
        _ <- writeDB(s"DELETE FROM ${schemaName}.doctor_patient WHERE doctor_name = ? AND patient_name = ?",
          List(SqlParameter("String", doctorName), SqlParameter("String", patientName))
        )
        a <- startTransaction {
          PatientQueryMessage(doctorName, patientName).send  //发个消息出去
          //        >>rollback() //考虑可以回滚，这里可以注释掉看看效果
        }
      } yield "OK"
    }
  }
