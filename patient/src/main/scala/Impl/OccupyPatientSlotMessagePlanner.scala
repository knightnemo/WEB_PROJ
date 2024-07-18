package Impl

import cats.effect.IO
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{WriteDBMessage, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.OccupyPatientSlotMessage
import io.circe.generic.auto._
import io.circe.syntax._

case class OccupyPatientSlotMessagePlanner(message: OccupyPatientSlotMessage, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    val OccupyPatientSlotMessage(patientName, slotNumber, courseName) = message

    val checkSlotAvailable = readDBBoolean(
      s"SELECT slot$slotNumber = '0' FROM ${schemaName}.patients WHERE user_name = ?",
      List(SqlParameter("String", patientName))
    )

    checkSlotAvailable.flatMap { isAvailable =>
      if (isAvailable) {
        val writeMessage = WriteDBMessage(
          s"UPDATE ${schemaName}.patients SET slot$slotNumber = ? WHERE user_name = ?",
          List(SqlParameter("String", courseName), SqlParameter("String", patientName))
        )

        writeMessage.asJson.as[WriteDBMessage].fold(
          error => IO.raiseError(new Exception(s"Failed to encode WriteDBMessage: ${error.getMessage}")),
          encodedMessage => encodedMessage.send.attempt.flatMap {
            case Right(_) => IO.pure(s"Slot $slotNumber for patient $patientName has been occupied with course $courseName")
            case Left(error) =>
              IO.raiseError(new Exception(s"Failed to occupy slot: ${error.getMessage}"))
          }
        )
      } else {
        IO.raiseError(new Exception(s"Slot $slotNumber for patient $patientName is already occupied"))
      }
    }
  }