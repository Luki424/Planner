type Props = {
  photo: string | null;
  caption: string;
  /** false, solange der gespeicherte Stand noch gelesen wird. */
  ready: boolean;
};

/**
 * Der Moment vor dem Tagesplan.
 *
 * Das Laden dauert einen Wimpernschlag – das ist die einzige Stelle, an der ein
 * großes Bild niemandem im Weg steht. Überall sonst würde es die Lesbarkeit des
 * Plans kosten, und man sieht es sowieso jeden Tag.
 */
export function StartScreen({ photo, caption, ready }: Props) {
  return (
    <div className={`start-screen${photo ? ' has-photo' : ''}${ready ? ' leaving' : ''}`}>
      {photo && <img className="start-photo" src={photo} alt="" aria-hidden />}
      <div className="start-inner">
        <span className="logo big" aria-hidden />
        <strong className="start-title">Tagesplaner</strong>
        {caption && <span className="start-caption">{caption}</span>}
      </div>
    </div>
  );
}
