package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.ReadDBRowsMessage
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.CheckPatientSlotAvailabilityMessage
import cats.effect.IO
import io.circe.generic.auto._
import io.circe.parser._

case class CheckPatientSlotAvailabilityMessagePlanner(
                                                       message: CheckPatientSlotAvailabilityMessage,
                                                       override val planContext: PlanContext
                                                     ) extends Planner[Boolean]:

  override def plan(using PlanContext): IO[Boolean] = {
    val CheckPatientSlotAvailabilityMessage(patientName, slotNumber) = message

    val readMessage = ReadDBRowsMessage(
      s"""
         |SELECT slot${slotNumber}
         |FROM ${schemaName}.patients
         |WHERE user_name = ?
      """.stripMargin,
      List(SqlParameter("String", patientName))
    )

    readMessage.send.flatMap { rows =>
      rows.headOption match {
        case Some(row) =>
          IO.fromEither(
            row.hcursor.get[String](s"slot$slotNumber").map(_ == "0")
          )
        case None =>
          IO.raiseError(new Exception(s"Patient $patientName not found"))
      }
    }
  }