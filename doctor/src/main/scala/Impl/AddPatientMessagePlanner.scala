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


case class AddPatientMessagePlanner(doctorName: String, patientName: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    /** step 1: 故意写入数据库 */
    startTransaction{
      for {
        _ <- writeDB(s"INSERT INTO ${schemaName}.doctor_patient (doctor_name, patient_name) VALUES (?, ?)",
          List(SqlParameter("String", doctorName), SqlParameter("String", ""))
        )
        a <- startTransaction {
          PatientQueryMessage(doctorName, patientName).send  //发个消息出去
//        >>rollback() //考虑可以回滚，这里可以注释掉看看效果
        }
      } yield "OK"
    }
  }

